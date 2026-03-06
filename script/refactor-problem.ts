import { readdir } from "node:fs/promises"

type RefactorProblemInput = {
  nodeWithPortPoints: unknown
  didsolved: boolean
}

type RefactorProblemResult = {
  problem: string
  didItSucceed: boolean
}

const sortByNumericFileName = (a: string, b: string) =>
  Number(a.replace(".json", "")) - Number(b.replace(".json", ""))

const main = async () => {
  const problemFiles = (await readdir("hg-problem"))
    .filter((file) => file.endsWith(".json") && file !== "results.json")
    .sort(sortByNumericFileName)

  const results: RefactorProblemResult[] = []

  for (const problemFile of problemFiles) {
    const filePath = `hg-problem/${problemFile}`
    const data = (await Bun.file(filePath).json()) as RefactorProblemInput

    await Bun.write(
      filePath,
      `${JSON.stringify(data.nodeWithPortPoints, null, 2)}\n`,
    )
    results.push({ problem: problemFile, didItSucceed: data.didsolved })
  }

  await Bun.write("hg-problem/results.json", `${JSON.stringify(results, null, 2)}\n`)
}

main().catch((error) => {
  console.error("Failed to refactor problem files:", error)
  process.exit(1)
})
