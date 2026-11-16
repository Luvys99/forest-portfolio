package com.olog.forestrelay.relay;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 브라우저 두 개가 붙은 상황을 흉내 낸다: A 가 먼저 들어오고 B 가 들어와 움직이고 나간다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RelayHandlerTest {

    @LocalServerPort
    int port;

    @Autowired
    ObjectMapper json;

    @Test
    @DisplayName("입장·이동·퇴장이 같은 방 사람들에게 전달되고, 보낸 사람에게는 돌아오지 않는다")
    void joinMoveLeaveAreRelayedWithinRoom() throws Exception {
        TestClient a = new TestClient(json).connect(port);
        a.send("""
                {"type":"join","name":" 숲지기 ","color":"9DFFD8","room":"forest"}""");
        JsonNode welcomeA = a.next();
        assertThat(welcomeA.path("type").asString()).isEqualTo("welcome");
        assertThat(welcomeA.path("players")).isEmpty();
        String idA = welcomeA.path("id").asString();

        TestClient b = new TestClient(json).connect(port);
        b.send("""
                {"type":"join","name":"방문자","color":"ffaa00","room":"forest"}""");
        JsonNode welcomeB = b.next();
        assertThat(welcomeB.path("players")).hasSize(1);
        assertThat(welcomeB.path("players").get(0).path("name").asString()).isEqualTo("숲지기"); // 공백 정리됨
        assertThat(welcomeB.path("players").get(0).path("color").asString()).isEqualTo("9dffd8"); // 소문자 통일
        String idB = welcomeB.path("id").asString();

        JsonNode joined = a.next();
        assertThat(joined.path("type").asString()).isEqualTo("joined");
        assertThat(joined.path("player").path("id").asString()).isEqualTo(idB);

        b.send("""
                {"type":"move","x":120.5,"y":640,"facing":-1,"state":"walk"}""");
        JsonNode moved = a.next();
        assertThat(moved.path("type").asString()).isEqualTo("moved");
        assertThat(moved.path("id").asString()).isEqualTo(idB);
        assertThat(moved.path("x").asDouble()).isEqualTo(120.5);
        assertThat(moved.path("facing").asInt()).isEqualTo(-1);
        b.assertSilent(); // 보낸 사람에게는 되돌아오지 않는다

        b.close();
        JsonNode left = a.next();
        assertThat(left.path("type").asString()).isEqualTo("left");
        assertThat(left.path("id").asString()).isEqualTo(idB);
        assertThat(idA).isNotEqualTo(idB);

        a.close();
    }

    @Test
    @DisplayName("방을 옮기면 이전 방엔 left, 새 방엔 joined, 본인에겐 새 방의 welcome")
    void roomChangeMovesPlayerBetweenRooms() throws Exception {
        TestClient forest = new TestClient(json).connect(port);
        forest.send("""
                {"type":"join","name":"숲","color":"9dffd8","room":"forest"}""");
        forest.next();

        TestClient sky = new TestClient(json).connect(port);
        sky.send("""
                {"type":"join","name":"하늘","color":"9dffd8","room":"sky"}""");
        sky.next();
        forest.assertSilent(); // 다른 방 입장은 보이지 않는다

        TestClient mover = new TestClient(json).connect(port);
        mover.send("""
                {"type":"join","name":"이동","color":"9dffd8","room":"forest"}""");
        String moverId = mover.next().path("id").asString();
        assertThat(forest.next().path("type").asString()).isEqualTo("joined");

        mover.send("""
                {"type":"room","room":"sky","x":100,"y":200}""");
        JsonNode welcome = mover.next();
        assertThat(welcome.path("type").asString()).isEqualTo("welcome");
        assertThat(welcome.path("room").asString()).isEqualTo("sky");
        assertThat(welcome.path("players")).hasSize(1);

        JsonNode left = forest.next();
        assertThat(left.path("type").asString()).isEqualTo("left");
        assertThat(left.path("id").asString()).isEqualTo(moverId);

        JsonNode joined = sky.next();
        assertThat(joined.path("type").asString()).isEqualTo("joined");
        assertThat(joined.path("player").path("id").asString()).isEqualTo(moverId);
        assertThat(joined.path("player").path("x").asDouble()).isEqualTo(100);

        forest.close();
        sky.close();
        mover.close();
    }

    @Test
    @DisplayName("잘못된 join 은 error 로 답하고, 잘못된 move·모르는 타입은 조용히 버린다")
    void invalidMessagesAreRejectedOrIgnored() throws Exception {
        TestClient a = new TestClient(json).connect(port);
        a.send("""
                {"type":"join","name":"이름이열두글자를넘어가는사람","color":"9dffd8","room":"forest"}""");
        JsonNode error = a.next();
        assertThat(error.path("type").asString()).isEqualTo("error");
        assertThat(error.path("reason").asString()).isEqualTo("invalid_join");

        a.send("""
                {"type":"join","name":"정상","color":"9dffd8","room":"forest"}""");
        a.next();

        TestClient b = new TestClient(json).connect(port);
        b.send("""
                {"type":"join","name":"관찰자","color":"9dffd8","room":"forest"}""");
        b.next();
        a.next(); // joined

        a.send("not json at all");
        a.send("""
                {"type":"move","x":999999,"y":0,"facing":1,"state":"walk"}""");   // 범위 밖
        a.send("""
                {"type":"move","x":10,"y":10,"facing":0,"state":"walk"}""");       // facing 잘못됨
        a.send("""
                {"type":"move","x":10,"y":10,"facing":1,"state":"fly"}""");        // 없는 상태
        a.send("""
                {"type":"attack","target":"b"}""");                                 // 모르는 타입
        b.assertSilent();

        a.close();
        b.close();
    }
}
