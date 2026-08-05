import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, PRODUCTS_SYNC_CURSOR_KEY } from "./db";
import { pullProducts, pushOutbox, queueMovement } from "./syncEngine";

const ACCESS_TOKEN = "test-token";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(async () => {
  await Promise.all([db.products.clear(), db.stockLevels.clear(), db.outboxMovements.clear(), db.meta.clear()]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("queueMovement + pushOutbox", () => {
  it("clears the outbox once the server confirms the movement", async () => {
    await queueMovement({ productId: "p1", type: "entrada", quantity: "10" });
    expect(await db.outboxMovements.count()).toBe(1);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(201, {
          movement: {
            id: "m1",
            productId: "p1",
            type: "entrada",
            quantity: "10",
            sequence: 1,
            createdBy: "u1",
            createdAt: new Date().toISOString(),
          },
          stockLevel: { productId: "p1", quantity: "10" },
        }),
      ),
    );

    await pushOutbox(ACCESS_TOKEN);
    expect(await db.outboxMovements.count()).toBe(0);
  });

  it("leaves a rejected movement as failed with the server's message, and does not retry it on its own", async () => {
    await queueMovement({ productId: "p1", type: "salida", quantity: "999" });

    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { error: "insufficient_stock", message: "Stock insuficiente" }));
    vi.stubGlobal("fetch", fetchMock);

    await pushOutbox(ACCESS_TOKEN);

    const [movement] = await db.outboxMovements.toArray();
    expect(movement).toBeDefined();
    expect(movement?.status).toBe("failed");
    expect(movement?.errorMessage).toBe("Stock insuficiente");

    fetchMock.mockClear();
    await pushOutbox(ACCESS_TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a movement pending (for retry) instead of failed when the request never reaches the server", async () => {
    await queueMovement({ productId: "p1", type: "entrada", quantity: "5" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await pushOutbox(ACCESS_TOKEN);

    const [movement] = await db.outboxMovements.toArray();
    expect(movement).toBeDefined();
    expect(movement?.status).toBe("pending");
    expect(movement?.errorMessage).toBeUndefined();
  });

  it("reverts the optimistic stock adjustment when a movement fails on sync", async () => {
    await db.stockLevels.put({ productId: "p1", quantity: "10" });
    await queueMovement({ productId: "p1", type: "salida", quantity: "999" });
    expect((await db.stockLevels.get("p1"))?.quantity).toBe("-989");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: "insufficient_stock", message: "Stock insuficiente" })),
    );
    await pushOutbox(ACCESS_TOKEN);

    expect((await db.stockLevels.get("p1"))?.quantity).toBe("10");
  });
});

describe("pullProducts", () => {
  it("advances the sync cursor and does not repeat products across separate calls", async () => {
    const productA = {
      id: "a",
      sku: "A",
      name: "Producto A",
      price: "1.00",
      active: true,
      version: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const productB = {
      id: "b",
      sku: "B",
      name: "Producto B",
      price: "1.00",
      active: true,
      version: 0,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { items: [productA], nextCursor: null })));
    await pullProducts(ACCESS_TOKEN);
    expect(await db.products.count()).toBe(1);
    expect((await db.meta.get(PRODUCTS_SYNC_CURSOR_KEY))?.value).toBe(productA.updatedAt);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { items: [productB], nextCursor: null })));
    await pullProducts(ACCESS_TOKEN);
    expect(await db.products.count()).toBe(2);

    const ids = (await db.products.toArray()).map((p) => p.id).sort();
    expect(ids).toEqual(["a", "b"]);
    expect((await db.meta.get(PRODUCTS_SYNC_CURSOR_KEY))?.value).toBe(productB.updatedAt);
  });
});
