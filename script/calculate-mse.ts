import { readFileSync } from "node:fs"
import { readdir } from "node:fs/promises"
import {
  calculateNodeProbabilityOfFailure,
  getIntraNodeCrossingsUsingCircle,
  type NodeWithPortPoints,
} from "./calculate-mse-core"

export * from "./calculate-mse-core"

type SolveResult = { fileName: string; didSolve: boolean }

const sortByNewest = (a: string, b: string) =>
  Number(Bun.file(`results/${b}`).lastModified) -
  Number(Bun.file(`results/${a}`).lastModified)

const main = async () => {
  const latest = (await readdir("results"))
    .filter((f) => f.endsWith(".json"))
    .sort(sortByNewest)[0]
  if (!latest) throw new Error("No result files found")

  const results = (await Bun.file(`results/${latest}`).json()) as SolveResult[]
  const sq: number[] = []

  for (const r of results) {
    try{
      readFileSync(`hg-problem/${r.fileName}`).toString()
    } catch(e) {
      console.warn(`Skipping ${r.fileName} - problem file not found`)
      continue
    }
    const raw = await Bun.file(`hg-problem/${r.fileName}`).json() as NodeWithPortPoints
    const c = getIntraNodeCrossingsUsingCircle(raw)
    const pred = calculateNodeProbabilityOfFailure(
      {
        ...raw,
        layer: "",
        availableZ: raw.availableZ ?? [0,1]
      },
      c.numSameLayerCrossings,
      c.numEntryExitLayerChanges,
      c.numTransitionPairCrossings
    )
    const actual = r.didSolve ? 0 : 1
    sq.push((pred - actual) ** 2)
  }

  if (sq.length === 0) throw new Error("No valid problems to evaluate")
  const mse = sq.reduce((a, b) => a + b, 0) / sq.length
  console.log(Number(mse.toFixed(8)))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
