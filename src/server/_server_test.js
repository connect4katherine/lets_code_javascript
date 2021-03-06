// Copyright (c) 2012 Titanium I.T. LLC. All rights reserved. See LICENSE.txt for details.
(function() {
	"use strict";

	const Server = require("./server.js");
	const fs = require("fs");
	const http = require("http");
	const assert = require("_assert");
	const ClientPointerMessage = require("../shared/client_pointer_message.js");
	const ServerPointerMessage = require("../shared/server_pointer_message.js");
	const SocketIoClient = require("./__socket_io_client.js");

	const CONTENT_DIR = "generated/test/";
	const NOT_FOUND_PAGE = "test404.html";
	const PORT = 5020;

	const INDEX_PAGE = "index.html";
	const INDEX_PAGE_CONTENTS = "This is the index page.";

	describe("Server", function() {

		let socketIoClient;
		let server;

		beforeEach(function(done) {
			fs.writeFile(CONTENT_DIR + INDEX_PAGE, INDEX_PAGE_CONTENTS, done);
		});

		afterEach(function(done) {
			fs.unlink(CONTENT_DIR + INDEX_PAGE, done);
		});

		beforeEach(async function() {
			server = new Server();
			await server.start(CONTENT_DIR, NOT_FOUND_PAGE, PORT);
			socketIoClient = new SocketIoClient("http://localhost:" + PORT, server._realTimeLogic._realTimeServer);
		});

		afterEach(async function() {
			try {
				const realTimeServer = server._realTimeServer;
				assert.equal(realTimeServer.numberOfActiveConnections(), 0, "afterEach() requires all sockets to be closed");
			}
			finally {
				await server.stop();
			}
		});

		it("serves HTML", function(done) {
			http.get("http://localhost:" + PORT, function(response) {
				let receivedData = "";
				response.setEncoding("utf8");

				response.on("data", function(chunk) {
					receivedData += chunk;
				});
				response.on("error", function(err) {
					assert.fail(err);
				});
				response.on("end", function() {
					assert.equal(receivedData, INDEX_PAGE_CONTENTS);
					done();
				});
			});
		});

		it("services real-time events", async function() {
			// Need to create our sockets serially because the tests won't exit if we don't.
			// I believe it's a bug in Socket.IO but I haven't been able to reproduce with a
			// trimmed-down test case. If you want to try converting this back to a parallel
			// implementation, be sure to run the tests about ten times because the issue doesn't
			// always occur. -JDLS 4 Aug 2017

			const emitter = await socketIoClient.createSocket();
			const receiver = await socketIoClient.createSocket();
			const clientMessage = new ClientPointerMessage(100, 200);

			emitter.emit(clientMessage.name(), clientMessage.payload());

			const actualPayload = await new Promise((resolve) => {
				receiver.once(ServerPointerMessage.MESSAGE_NAME, resolve);
			});

			assert.deepEqual(actualPayload, clientMessage.toServerMessage(emitter.id).payload());
			await new Promise((resolve) => setTimeout(resolve, 0));
			await socketIoClient.closeSocket(emitter);
			await socketIoClient.closeSocket(receiver);
		});

	});

}());