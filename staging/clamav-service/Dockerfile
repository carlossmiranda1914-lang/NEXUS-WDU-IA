FROM node:20-alpine

RUN apk add --no-cache clamav clamav-daemon clamav-libunrar netcat-openbsd

# Run initial freshclam during build so database is preloaded
RUN mkdir -p /run/clamav /var/lib/clamav /var/log/clamav && \
    chown -R clamav:clamav /run/clamav /var/lib/clamav /var/log/clamav && \
    freshclam --quiet || true

WORKDIR /app

COPY package.json server.mjs start.sh ./
RUN chmod +x start.sh

EXPOSE 8080 3310

CMD ["/app/start.sh"]
