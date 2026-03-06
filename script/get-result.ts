import { HighDensitySolver } from "@tscircuit/capacity-autorouter";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import type { NodeWithPortPoints } from "./calculate-mse";


const main = async () => {
    const pkgJson = JSON.parse(readFileSync("package.json", "utf-8").toString())
    const versionOfCapacityAutorouter = pkgJson.dependencies["@tscircuit/capacity-autorouter"] || pkgJson.devDependencies["@tscircuit/capacity-autorouter"]
    const problem = (await readdir("hg-problem")).filter(files => files !== "index.ts" && files !== "result.json").sort((a, b) => {
        const numA = parseInt(a.split(".")[0] as string)
        const numB = parseInt(b.split(".")[0] as string)
        return numA - numB
    })
    const ctx = problem.map((file) => {
        return {input: JSON.parse(readFileSync(`hg-problem/${file}`, "utf-8").toString()) as NodeWithPortPoints, fileName: file}
    })

    const results = []

    for (const {input, fileName} of ctx) {
        const startTime = Date.now()
        let solver: HighDensitySolver | undefined
        try {
        solver = new HighDensitySolver({
            nodePortPoints: [input],
         })
         solver.solve()
        } catch (e) {
            console.error(`Error solving ${fileName}:`, e);
        }
        const endTime = Date.now()
        if(solver === undefined) {
            results.push({fileName, didSolve: false, timeSeconds: (endTime - startTime) / 1000})
            continue
        }
        console.log(`${fileName} -> didSolve ${solver?.solved} in ${(endTime - startTime) / 1000}s`);
        results.push({fileName, didSolve: solver.solved, timeSeconds: (endTime - startTime) / 1000})
        
    }

    await Bun.write(`results/${versionOfCapacityAutorouter}-${Date.now()}.json`, `${JSON.stringify(results, null, 2)}\n`)

}


main()