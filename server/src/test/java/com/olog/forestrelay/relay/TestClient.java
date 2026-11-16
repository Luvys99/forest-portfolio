package com.olog.forestrelay.relay;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** 브라우저 하나 역할. 받은 메시지를 큐에 쌓아 두고 테스트가 하나씩 꺼내 본다. */
class TestClient extends TextWebSocketHandler {

    private final ObjectMapper json;
    private final BlockingQueue<JsonNode> inbox = new LinkedBlockingQueue<>();
    WebSocketSession session;

    TestClient(ObjectMapper json) {
        this.json = json;
    }

    TestClient connect(int port) throws Exception {
        session = new StandardWebSocketClient()
                .execute(this, "ws://localhost:" + port + "/ws")
                .get(5, TimeUnit.SECONDS);
        return this;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        inbox.add(json.readTree(message.getPayload()));
    }

    void send(String payload) throws Exception {
        session.sendMessage(new TextMessage(payload));
    }

    void send(JsonNode payload) throws Exception {
        send(json.writeValueAsString(payload));
    }

    JsonNode next() throws Exception {
        JsonNode node = inbox.poll(3, TimeUnit.SECONDS);
        assertThat(node).as("메시지를 3초 안에 받아야 한다").isNotNull();
        return node;
    }

    void assertSilent() throws Exception {
        assertThat(inbox.poll(300, TimeUnit.MILLISECONDS)).as("메시지가 오면 안 된다").isNull();
    }

    void close() throws Exception {
        session.close();
    }
}
