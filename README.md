# Curss

A Rust application with OpenTelemetry integration for Jaeger.

## OpenTelemetry with Jaeger Setup

This application is configured to send OpenTelemetry traces to Jaeger. To set up:

1. **Start Jaeger**: Run Jaeger with Docker:
   ```bash
   docker run -d -p4317:4317 -p16686:16686 jaegertracing/all-in-one:latest
   ```

2. **Set environment variables** (optional):
   ```bash
   # Jaeger OTLP endpoint (optional - defaults to http://localhost:4317/v1/traces)
   JAEGER_ENDPOINT=http://localhost:4317/v1/traces

   # Redis configuration
   REDIS_URL=redis://localhost:6379
   ```

3. **Run the application**:
   ```bash
   cargo run
   ```

The application will automatically send traces to Jaeger when requests are made to the endpoints.

### Supported Features

- **Traces**: ✅ Fully supported - traces are sent to Jaeger via OTLP HTTP
- **Logs**: ❌ Not yet configured
- **Metrics**: ❌ Not yet configured

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JAEGER_ENDPOINT` | Jaeger OTLP endpoint | `"http://localhost:4317/v1/traces"` |
| `REDIS_URL` | Redis connection URL | `"redis://localhost:6379"` |

## Running the Application

```bash
# Install dependencies
cargo build

# Run with default configuration
cargo run

# Or set environment variables inline
JAEGER_ENDPOINT=http://localhost:4317/v1/traces cargo run
```

The application will start on `http://localhost:3000` with the following endpoints:
- `GET /` - Health check
- `GET /follow-list` - Get follow list
- `GET /feed` - Get feed

### Viewing Traces

Once your application is running, you can view traces in the Jaeger UI:
- Open your browser and go to `http://localhost:16686`
- Select "curss" from the service dropdown
- Click "Find Traces" to see all traces

The Jaeger UI will show you detailed trace information including spans, timing, and any errors that occurred during request processing.
