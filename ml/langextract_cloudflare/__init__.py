"""LangExtract provider plugin for Cloudflare Workers AI.

Uses the OpenAI-compatible /v1/chat/completions endpoint so that any
text-generation model hosted on Workers AI can be used with langextract.
"""

from langextract_cloudflare.provider import CloudflareWorkersAIProvider

__all__ = ["CloudflareWorkersAIProvider"]
__version__ = "0.1.0"
