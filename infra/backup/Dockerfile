# Minimal Alpine image for PostgreSQL backup to Scaleway Object Storage
# ~25 MB total — runs as Scaleway Serverless Job
FROM alpine:3.21

RUN apk add --no-cache \
    postgresql16-client \
    rclone

COPY backup.sh /backup.sh
RUN chmod +x /backup.sh

ENTRYPOINT ["/backup.sh"]
