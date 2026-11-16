package com.olog.forestrelay.relay;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ValidationTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    @DisplayName("이름은 공백·제어 문자를 정리하고 1~12자만 받는다")
    void nameIsTrimmedAndLengthLimited() {
        assertThat(Validation.name(json.readTree("\"  숲지기  \""))).isEqualTo("숲지기");
        assertThat(Validation.name(json.readTree("\"a\\u0007b\""))).isEqualTo("ab");   // 제어 문자 제거
        assertThat(Validation.name(json.readTree("\"   \""))).isNull();
        assertThat(Validation.name(json.readTree("\"열두글자를넘어가는이름입니다\""))).isNull();
        assertThat(Validation.name(json.readTree("123"))).isNull();
    }

    @Test
    @DisplayName("말풍선 글은 이름과 같은 방식으로 정리하고 1~40자만 받는다")
    void chatIsTrimmedAndLengthLimited() {
        assertThat(Validation.chat(json.readTree("\"  안녕  \""))).isEqualTo("안녕");
        assertThat(Validation.chat(json.readTree("\"" + "가".repeat(Validation.CHAT_MAX) + "\""))).hasSize(Validation.CHAT_MAX);
        assertThat(Validation.chat(json.readTree("\"" + "가".repeat(Validation.CHAT_MAX + 1) + "\""))).isNull();
        assertThat(Validation.chat(json.readTree("\"   \""))).isNull();
    }

    @Test
    @DisplayName("색은 hex 6자리만 받고 소문자로 통일한다")
    void colorIsSixHexDigitsLowercased() {
        assertThat(Validation.color(json.readTree("\"9DFFD8\""))).isEqualTo("9dffd8");
        assertThat(Validation.color(json.readTree("\"#9dffd8\""))).isNull();
        assertThat(Validation.color(json.readTree("\"fff\""))).isNull();
    }

    @Test
    @DisplayName("facing 은 1/-1, state 는 네 가지 값만 받는다")
    void facingAndStateAcceptOnlyKnownValues() {
        assertThat(Validation.facing(json.readTree("1"))).isEqualTo(1);
        assertThat(Validation.facing(json.readTree("-1"))).isEqualTo(-1);
        assertThat(Validation.facing(json.readTree("0"))).isNull();
        assertThat(Validation.state(json.readTree("\"climb\""))).isEqualTo("climb");
        assertThat(Validation.state(json.readTree("\"fly\""))).isNull();
    }

    /**
     * 이름 길이 제한은 클라이언트(skyRecords.ts), DB(sky_records.sql), 서버 세 곳에 손으로 적혀 있다.
     * 서버 값이 DB check 제약과 같은지 본다. 클라이언트 쪽은 client/src/lib/skyRecords.test.ts 가 같은 SQL을 읽는다.
     */
    @Test
    @DisplayName("이름 길이 제한이 supabase/sky_records.sql 의 check 제약과 같다")
    void nameLimitMatchesDatabaseCheckConstraint() throws IOException {
        String sql = Files.readString(Path.of("..", "supabase", "sky_records.sql"));
        assertThat(sql).containsPattern("char_length\\(name\\) between 1 and " + Validation.NAME_MAX + "\\b");
    }
}
