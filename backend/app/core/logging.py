import time
import json
import logging
import sys
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

# Configure logging
logger = logging.getLogger("business_intel_api")
logger.setLevel(logging.INFO)

# JSON logging formatter
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "name": record.name,
            "filename": record.filename,
            "lineno": record.lineno,
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)

# Prometheus Metrics
API_REQUESTS = Counter(
    "api_requests_total", 
    "Total API requests processed", 
    ["method", "endpoint", "status_code"]
)
REQUEST_LATENCY = Histogram(
    "api_request_duration_seconds", 
    "Latency of API requests in seconds", 
    ["endpoint"]
)
PLACES_API_CALLS = Counter(
    "places_api_calls_total", 
    "Total Google Places API calls", 
    ["type", "status"]  # type: "search", "details", "photo"
)
SCRAPER_CALLS = Counter(
    "scraper_calls_total", 
    "Total website crawls", 
    ["status"]  # status: "success", "failed", "timeout"
)
LLM_CALLS = Counter(
    "llm_calls_total", 
    "Total LLM analyzer operations", 
    ["provider", "status"]  # provider: "gemini", "openai", "ollama"
)

class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        
        # Don't log metrics endpoint itself
        if request.url.path == "/metrics":
            return await call_next(request)
            
        endpoint = request.url.path
        method = request.method
        
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            logger.exception(f"Unhandled exception during request: {str(e)}")
            raise e
        finally:
            latency = time.time() - start_time
            API_REQUESTS.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
            REQUEST_LATENCY.labels(endpoint=endpoint).observe(latency)
            logger.info(f"Processed request: {method} {endpoint} - {status_code} (took {latency:.4f}s)")
            
        return response

def get_prometheus_metrics():
    """Generates Prometheus format metrics."""
    return generate_latest(), CONTENT_TYPE_LATEST
