# AWS SageMaker Unified Studio Data Platform

## Overview

This is a project to build a full data platform using AWS services.

In particular, it is designed to work with the [AWS SageMaker Unified Studio](https://aws.amazon.com/sagemaker/unified-studio/) system. I won't document too much of the setup here as it is designed to change a lot over time as I test out different things, but feel free to have a look around.

You should find that most things are configurable via environment-specific JSON files in the `config` directory.

## Setup

```bash
pnpm install
```

## Deploy

```bash
pnpm run deploy:full
```

You can also deploy a production environment by running:

```bash
pnpm run deploy:prod
```

## Destroy

```bash
pnpm run destroy
```