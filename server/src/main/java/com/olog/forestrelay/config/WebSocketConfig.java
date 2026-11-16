package com.olog.forestrelay.config;

import com.olog.forestrelay.relay.RelayHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * /ws 에 중계 핸들러를 붙인다.
 * STOMP 같은 상위 프로토콜은 쓰지 않는다. 브라우저의 기본 WebSocket 객체로 바로 붙을 수 있게 순수 JSON 텍스트 프레임만 주고받는다.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final RelayHandler relayHandler;
    private final RelayProperties properties;

    public WebSocketConfig(RelayHandler relayHandler, RelayProperties properties) {
        this.relayHandler = relayHandler;
        this.properties = properties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(relayHandler, "/ws")
                .setAllowedOrigins(properties.allowedOrigins().toArray(String[]::new));
    }
}
