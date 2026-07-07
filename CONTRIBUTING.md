# Contributing

Telos is developed as a canonical public Community Edition. Contributions should keep the app runnable, understandable, and useful for people who want to learn, self-host, or build on the engine.

## Good First Areas

- Core learning engine correctness and tests.
- Knowledge graph and learner-state data contracts.
- Local runtime reliability.
- Web app accessibility, responsiveness, and empty/error states.
- Examples, docs, and self-hosting guides.
- Agent skill improvements that reuse the public engine.

## Development

```bash
./start.sh
make test
bash scripts/build-pages.sh
```

Before opening a pull request, make sure the app still starts locally and the engine tests pass.

## Pull Request Standard

- Keep changes focused and easy to review.
- Include tests for algorithmic changes in `core/`.
- Do not commit `.env`, keys, tokens, real user data, or private deployment config.
- Do not add official hosted-service secrets, payment-provider product IDs, internal metrics, or private template payloads.
- Use plain public examples when documentation needs sample IDs or credentials.

## License

By contributing, you agree that your contribution can be distributed under the repository licenses:

- Telos Community Edition: AGPL-3.0
- `core/`: Apache-2.0 for standalone SDK/protocol reuse
