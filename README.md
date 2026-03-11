# high-density-dataset-z04

A dataset package for high-density autorouting problems from `autorouter-dataset-01`.

## What this package contains

- Problem files exported as JSON in the `hg-problem/` directory
- Recovered hard problems exported through `hard-problem/`
- Versioned run results in the `results/` directory
- Utility scripts in the `script/` directory

## Installation

Install directly from GitHub:

```bash
bun add https://github.com/tscircuit/high-density-dataset-z04.git
```

## Results format

The `results/` directory stores files in the format:

- `version-timestamp.json`

Each file records whether each problem succeeded for a specific autorouter version.

## Scripts

- `script/get-result.ts`: Runs all problems against a target autorouter version and saves the result summary as JSON.
- `script/calculate-mse.ts`: Calculates the latest MSE score from generated results.

 
