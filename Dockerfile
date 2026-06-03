FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod ./go.mod
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /tmp/core-customer .

FROM alpine:3.22
WORKDIR /app
COPY --from=builder /tmp/core-customer /usr/local/bin/core-customer
ENV APP_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["/usr/local/bin/core-customer"]
