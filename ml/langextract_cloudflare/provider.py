"""Cloudflare Workers AI provider for LangExtract.

Implements the BaseLanguageModel interface by calling the Cloudflare
Workers AI OpenAI-compatible chat completions endpoint:

    POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions

Environment variables (or constructor params):
    CLOUDFLARE_ACCOUNT_ID  – your Cloudflare account ID
    CLOUDFLARE_API_TOKEN   – API token with Workers AI permission
    CLOUDFLARE_MODEL       – model name, e.g. @cf/meta/llama-3.3-70b-instruct-fp8-fast
"""

from __future__ import annotations

import json
import os
from typing import Any, Iterator, Sequence

import requests

import langextract as lx
from langextract.core import base_model
from langextract.core import types as lx_types


# Register with langextract's provider registry.
# Pattern matches Cloudflare model IDs like "@cf/meta/llama-..." as well as
# the shorthand "cloudflare" or "cf-..." names.
@lx.providers.registry.register(
    r"^@cf/",            # official CF model IDs
    r"^cloudflare",      # friendly alias
    r"^cf-",             # shorthand
    priority=10,
)
class CloudflareWorkersAIProvider(base_model.BaseLanguageModel):
    """LangExtract provider backed by Cloudflare Workers AI.

    Uses the OpenAI-compatible /v1/chat/completions REST endpoint so that
    any text-generation model on Workers AI can be utilised.

    Attributes:
        model_id: Full Cloudflare model identifier (e.g. "@cf/meta/...").
        account_id: Cloudflare account ID.
        api_token: Cloudflare API token.
        temperature: Sampling temperature.
        max_tokens: Maximum tokens to generate.
    """

    # Tell langextract this provider needs fenced output (no native schema).
    requires_fence_output = True

    def __init__(
        self,
        model_id: str = "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        account_id: str | None = None,
        api_token: str | None = None,
        api_key: str | None = None,  # langextract passes this kwarg
        temperature: float = 0.1,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> None:
        super().__init__()
        self.model_id = model_id
        self.account_id = account_id or os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
        self.api_token = (
            api_token
            or api_key
            or os.environ.get("CLOUDFLARE_API_TOKEN", "")
            or os.environ.get("LANGEXTRACT_API_KEY", "")
        )
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._extra_kwargs = kwargs

        if not self.account_id:
            raise lx.exceptions.InferenceConfigError(
                "Cloudflare account ID required. "
                "Set CLOUDFLARE_ACCOUNT_ID or pass account_id=."
            )
        if not self.api_token:
            raise lx.exceptions.InferenceConfigError(
                "Cloudflare API token required. "
                "Set CLOUDFLARE_API_TOKEN or pass api_token=."
            )

        self._base_url = (
            f"https://api.cloudflare.com/client/v4/accounts/"
            f"{self.account_id}/ai/v1/chat/completions"
        )

    # ------------------------------------------------------------------
    # langextract interface
    # ------------------------------------------------------------------

    def infer(
        self,
        batch_prompts: Sequence[str],
        **kwargs: Any,
    ) -> Iterator[Sequence[lx.inference.ScoredOutput]]:
        """Run inference on a batch of prompts.

        Args:
            batch_prompts: Input prompts to process.
            **kwargs: Additional generation parameters.

        Yields:
            Lists of ScoredOutput, one list per prompt.
        """
        temperature = kwargs.get("temperature", self.temperature)
        max_tokens = kwargs.get("max_tokens", self.max_tokens)

        for prompt in batch_prompts:
            payload = {
                "model": self.model_id,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            try:
                resp = requests.post(
                    self._base_url,
                    headers={
                        "Authorization": f"Bearer {self.api_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=120,
                )
                resp.raise_for_status()
                data = resp.json()

                # OpenAI-compatible response shape
                choices = data.get("choices") or []
                if choices:
                    text = (
                        choices[0].get("message", {}).get("content", "")
                        or ""
                    )
                else:
                    text = ""

                yield [lx_types.ScoredOutput(score=1.0, output=text.strip())]

            except requests.RequestException as exc:
                raise lx.exceptions.InferenceRuntimeError(
                    f"Cloudflare Workers AI request failed: {exc}",
                    original=exc,
                ) from exc
            except (KeyError, json.JSONDecodeError) as exc:
                raise lx.exceptions.InferenceRuntimeError(
                    f"Unexpected response format from Workers AI: {exc}",
                    original=exc,
                ) from exc
