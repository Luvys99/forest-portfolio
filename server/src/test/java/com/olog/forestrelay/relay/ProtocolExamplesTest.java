package com.olog.forestrelay.relay;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 메시지 규약 예시(relay-messages.json)가 서버 코드와 맞는지.
 * 같은 파일을 클라이언트 테스트(client/src/lib/relay.test.ts)도 읽으므로, 규약을 바꾸면 양쪽 테스트가 같이 깨진다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProtocolExamplesTest {

    @LocalServerPort
    int port;

    @Autowired
    ObjectMapper json;

    private JsonNode examples() throws IOException {
        try (InputStream in = getClass().getResourceAsStream("/relay-messages.json")) {
            return json.readTree(in);
        }
    }

    @Test
    @DisplayName("서버 → 클라이언트 예시는 Messages 의 record 와 필드가 정확히 같다")
    void serverToClientExamplesMatchRecords() throws IOException {
        JsonNode s2c = examples().get("serverToClient");
        Map<String, Class<?>> types = Map.of(
                "welcome", Messages.Welcome.class,
                "joined", Messages.Joined.class,
                "moved", Messages.Moved.class,
                "left", Messages.Left.class,
                "error", Messages.Error.class);

        for (Map.Entry<String, Class<?>> entry : types.entrySet()) {
            JsonNode example = s2c.get(entry.getKey());
            assertThat(example).as("예시에 %s 가 있어야 한다", entry.getKey()).isNotNull();
            Object parsed = json.treeToValue(example, entry.getValue());
            JsonNode serialized = json.valueToTree(parsed);
            assertThat(serialized).as(entry.getKey()).isEqualTo(example);
        }
    }

    @Test
    @DisplayName("클라이언트 → 서버 예시를 그대로 보내면 서버가 받아들인다")
    void clientToServerExamplesAreAccepted() throws Exception {
        JsonNode c2s = examples().get("clientToServer");

        TestClient a = new TestClient(json).connect(port);
        a.send(c2s.get("join"));
        JsonNode welcome = a.next();
        assertThat(welcome.path("type").asString()).isEqualTo("welcome");
        assertThat(welcome.path("room").asString()).isEqualTo("forest");

        TestClient b = new TestClient(json).connect(port);
        b.send(c2s.get("join"));
        b.next();
        a.next(); // joined

        b.send(c2s.get("move"));
        JsonNode moved = a.next();
        assertThat(moved.path("type").asString()).isEqualTo("moved");
        assertThat(moved.path("x").asDouble()).isEqualTo(c2s.get("move").path("x").asDouble());

        b.send(c2s.get("room"));
        assertThat(b.next().path("room").asString()).isEqualTo("sky");
        assertThat(a.next().path("type").asString()).isEqualTo("left");

        a.close();
        b.close();
    }
}
