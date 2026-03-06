import { readdir } from "node:fs/promises"

export type PortPoint = {
  connectionName: string
  x: number
  y: number
  z: number
}

export type NodeWithPortPoints = {
  center: { x: number; y: number }
  width: number
  height: number
  portPoints: PortPoint[]
  availableZ?: number[]
}

type SolveResult = { fileName: string; didSolve: boolean }

const sortByNewest = (a: string, b: string) =>
  Number(Bun.file(`results/${b}`).lastModified) -
  Number(Bun.file(`results/${a}`).lastModified)

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

const getCapacity = (node: NodeWithPortPoints) => {
  const v = 0.3
  const m = 0.2
  const c = (node.width / (v / 2 + m) / 2) ** 1.1
  return (node.availableZ?.length ?? 2) === 1 && c > 1 ? 1 : c
}

const perimeterT = (
  p: { x: number; y: number },
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
) => {
  const w = xmax - xmin
  const h = ymax - ymin
  const e = 1e-6
  if (Math.abs(p.y - ymax) < e) return p.x - xmin
  if (Math.abs(p.x - xmax) < e) return w + (ymax - p.y)
  if (Math.abs(p.y - ymin) < e) return w + h + (xmax - p.x)
  if (Math.abs(p.x - xmin) < e) return 2 * w + h + (p.y - ymin)
  const dt = Math.abs(p.y - ymax)
  const dr = Math.abs(p.x - xmax)
  const db = Math.abs(p.y - ymin)
  const dl = Math.abs(p.x - xmin)
  const d = Math.min(dt, dr, db, dl)
  if (d === dt) return Math.max(0, Math.min(w, p.x - xmin))
  if (d === dr) return w + Math.max(0, Math.min(h, ymax - p.y))
  if (d === db) return w + h + Math.max(0, Math.min(w, xmax - p.x))
  return 2 * w + h + Math.max(0, Math.min(h, p.y - ymin))
}

const countChordCrossings = (chords: Array<[number, number]>) => {
  let n = 0
  const c = chords.map(([a, b]) => (a < b ? [a, b] : [b, a]) as [number, number])
  for (let i = 0; i < c.length; i++) {
    const [a, b] = c[i]!
    for (let j = i + 1; j < c.length; j++) {
      const [x, y] = c[j]!
      if ([a, b].some((u) => [x, y].some((v) => Math.abs(u - v) < 1e-6))) continue
      if ((a < x && x < b && b < y) || (x < a && a < y && y < b)) n++
    }
  }
  return n
}

const getCounts = (node: NodeWithPortPoints) => {
  const xmin = node.center.x - node.width / 2
  const xmax = node.center.x + node.width / 2
  const ymin = node.center.y - node.height / 2
  const ymax = node.center.y + node.height / 2

  const byConn = new Map<string, Array<{ x: number; y: number; z: number }>>()
  for (const p of node.portPoints) {
    const arr = byConn.get(p.connectionName) ?? []
    if (!arr.some((q) => q.x === p.x && q.y === p.y && q.z === p.z)) arr.push(p)
    byConn.set(p.connectionName, arr)
  }

  const byLayer = new Map<number, Array<[number, number]>>()
  const trans: Array<[number, number]> = []
  let layerChanges = 0

  for (const [, pts] of byConn) {
    if (pts.length < 2) continue
    const p1 = pts[0]!
    const p2 = pts[1]!
    const t1 = perimeterT(p1, xmin, xmax, ymin, ymax)
    const t2 = perimeterT(p2, xmin, xmax, ymin, ymax)
    if (p1.z === p2.z) {
      const arr = byLayer.get(p1.z) ?? []
      arr.push([t1, t2])
      byLayer.set(p1.z, arr)
    } else {
      layerChanges++
      trans.push([t1, t2])
    }
  }

  let sameLayerCrossings = 0
  for (const [, chords] of byLayer) sameLayerCrossings += countChordCrossings(chords)

  return {
    sameLayerCrossings,
    layerChanges,
    transitionCrossings: countChordCrossings(trans),
  }
}

const predictFailureProb = (node: NodeWithPortPoints) => {
  const c = getCounts(node)
  if (
    (node.availableZ?.length ?? 2) === 1 &&
    (c.sameLayerCrossings > 0 || c.layerChanges > 0 || c.transitionCrossings > 0)
  ) {
    return 1
  }
  const estVias =
    c.sameLayerCrossings * 0.82 + c.layerChanges * 0.41 + c.transitionCrossings * 0.2
  return clamp01(((estVias / 2) ** 1.1) / getCapacity(node))
}

const asNode = (v: unknown): NodeWithPortPoints | undefined => {
  if (!v || typeof v !== "object") return undefined
  const d = v as Partial<NodeWithPortPoints>
  if (d.center && typeof d.width === "number") return d as NodeWithPortPoints
  const w = (v as { nodeWithPortPoints?: NodeWithPortPoints }).nodeWithPortPoints
  return w && w.center && typeof w.width === "number" ? w : undefined
}

const main = async () => {
  const latest = (await readdir("results"))
    .filter((f) => f.endsWith(".json"))
    .sort(sortByNewest)[0]
  if (!latest) throw new Error("No result files found")

  const results = (await Bun.file(`results/${latest}`).json()) as SolveResult[]
  const sq: number[] = []

  for (const r of results) {
    const raw = await Bun.file(`hg-problem/${r.fileName}`).json()
    const node = asNode(raw)
    if (!node) continue
    const pred = predictFailureProb(node)
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
