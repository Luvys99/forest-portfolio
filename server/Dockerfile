# 중계 서버 컨테이너. 배포 플랫폼(Fly.io 등)이 이 파일로 이미지를 만든다
# 로컬 확인: docker build -t forest-relay . && docker run -p 8081:8081 forest-relay

# 1. 빌드: Gradle 로 실행 가능한 jar 하나를 만든다 (테스트는 CI 에서 이미 돈다)
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY src src
RUN ./gradlew --no-daemon bootJar -x test

# 2. 실행: JRE 만 담은 작은 이미지
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
RUN useradd --system relay
USER relay
# 플랫폼이 PORT 를 정해 주면 그 포트로 듣는다 (application.yml)
EXPOSE 8081
# 컨테이너 메모리 한도의 75% 까지 힙으로 쓴다
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
