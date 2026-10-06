// The v4 panel's wallet choice, through the SDK's own v1-v4 client: the hint decides which
// socket the client opens.

import { afterEach, describe, expect, it } from "vitest";
import { PhantasmaLink } from "phantasma-sdk-ts/public";
import { hasV4Extension, providerHintFor } from "./v4-wallet";

const opened: string[] = [];

class FakeInjectedSocket {
	constructor() {
		opened.push("extension");
	}
	send() {}
	close() {}
}

class FakeWebSocket {
	constructor(url: string) {
		opened.push(url);
	}
	send() {}
	close() {}
}

const host = globalThis as { window?: unknown; WebSocket?: unknown };
const originalWebSocket = host.WebSocket;

afterEach(() => {
	opened.length = 0;
	delete host.window;
	host.WebSocket = originalWebSocket;
});

describe("v4 wallet choice", () => {
	it("detects an extension that serves v1-v4", () => {
		expect(hasV4Extension({ PhantasmaLinkSocket: FakeInjectedSocket })).toBe(true);
		expect(hasV4Extension({})).toBe(false);
		expect(hasV4Extension(undefined)).toBe(false);
	});

	it("opens the socket of the chosen wallet", () => {
		host.window = { PhantasmaLinkSocket: FakeInjectedSocket };
		host.WebSocket = FakeWebSocket;

		new PhantasmaLink("test", false).login(() => {}, () => {}, 4, "phantasma", providerHintFor("extension"));
		new PhantasmaLink("test", false).login(() => {}, () => {}, 4, "phantasma", providerHintFor("desktop"));

		expect(opened).toEqual(["extension", "ws://localhost:7090/phantasma"]);
	});
});
