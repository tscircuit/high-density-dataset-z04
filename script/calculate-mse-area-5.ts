import { readFileSync } from "node:fs"
import { readdir } from "node:fs/promises"

export type PortPoint = {
  connectionName: string
  x: number
  y: number
  z: number
}

const DEFAULT_VIA_DIAMETER = 0.3

type CapacityMeshNodeId = string

export interface CapacityMeshNode {
  capacityMeshNodeId: string
  center: { x: number; y: number }
  width: number
  height: number
  layer: string
  availableZ: number[]

  _depth?: number

  _completelyInsideObstacle?: boolean
  _containsObstacle?: boolean
  _containsTarget?: boolean
  _targetConnectionName?: string
  _strawNode?: boolean
  _strawParentCapacityMeshNodeId?: CapacityMeshNodeId
  _isVirtualOffboard?: boolean
  _offboardNetName?: string

  _adjacentNodeIds?: CapacityMeshNodeId[]

  _offBoardConnectionId?: string
  _offBoardConnectedCapacityMeshNodeIds?: CapacityMeshNodeId[]

  _parent?: CapacityMeshNode
}

export type NodeWithPortPoints = {
  capacityMeshNodeId: string
  center: { x: number; y: number }
  width: number
  height: number
  portPoints: PortPoint[]
  availableZ?: number[]
}

type SolveResult = { fileName: string; didSolve: boolean }

type FailureModelParams = {
  viaDiameter?: number
  capacityWeight?: number
  viaAreaRatioWeight?: number
  minDimensionRatioWeight?: number
  crossingDensityWeight?: number
  transitionWeight?: number
  areaAdjustmentWeight?: number
  areaCapacityFactor?: number
  areaViaAreaFactor?: number
  areaCrossingDensityFactor?: number
  sameLayerViaWeight?: number
  entryExitViaWeight?: number
  transitionViaWeight?: number
  scoreBias?: number
  scoreExponent?: number
}

const sortByNewest = (a: string, b: string) =>
  Number(Bun.file(`results/${b}`).lastModified) -
  Number(Bun.file(`results/${a}`).lastModified)



  /**
 * Calculate the capacity of a node based on its width
 *
 * This capacity corresponds to how many vias the node can fit, tuned for two
 * layers.
 *
 * @param nodeOrWidth The node or width to calculate capacity for
 * @param maxCapacityFactor Optional multiplier to adjust capacity
 * @returns The calculated capacity
 */
export const getTunedTotalCapacity1 = (
  nodeOrWidth: CapacityMeshNode | { width: number; availableZ?: number[] },
  maxCapacityFactor = 1,
  opts: { viaDiameter?: number; obstacleMargin?: number } = {},
) => {
  const VIA_DIAMETER = opts.viaDiameter ?? DEFAULT_VIA_DIAMETER
  const TRACE_WIDTH = 0.15
  const obstacleMargin = opts.obstacleMargin ?? 0.2

  const width = "width" in nodeOrWidth ? nodeOrWidth.width : nodeOrWidth
  const viaLengthAcross = width / (VIA_DIAMETER / 2 + obstacleMargin)

  const tunedTotalCapacity = (viaLengthAcross / 2) ** 1.1 * maxCapacityFactor

  if (nodeOrWidth.availableZ?.length === 1 && tunedTotalCapacity > 1) {
    return 1
  }

  return tunedTotalCapacity
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const getAreaBucketAdjustment = (nodeArea: number) => {
  if (nodeArea < 25) return -0.0214
  if (nodeArea < 50) return 0.1718
  if (nodeArea < 65) return 0.1853
  if (nodeArea < 100) return 0.1455
  if (nodeArea < 150) return 0.0979
  if (nodeArea < 250) return 0.0854
  if (nodeArea < 500) return 0.069
  return 0.2316
}

const getNodeFailureFeatures = (
  node: CapacityMeshNode,
  estNumVias: number,
  numSameLayerCrossings: number,
  numEntryExitLayerChanges: number,
  numTransitionCrossings: number,
  viaDiameter: number,
) => {
  const width = Math.max(node.width, 1e-6)
  const height = Math.max(node.height, 1e-6)
  const nodeArea = Math.max(width * height, 1e-6)
  const minDimension = Math.max(Math.min(width, height), 1e-6)
  const viaRadius = viaDiameter / 2
  const viaArea = Math.PI * viaRadius * viaRadius
  const totalCapacity = Math.max(
    getTunedTotalCapacity1(node, 1, { viaDiameter }),
    1e-6,
  )
  const estUsedCapacity = Math.max((estNumVias / 2) ** 1.1, 0)
  const capacityRatio = estUsedCapacity / totalCapacity
  const viaAreaRatio = (estNumVias * viaArea) / nodeArea
  const minDimensionRatio = viaDiameter / minDimension
  const totalCrossings =
    numSameLayerCrossings +
    numEntryExitLayerChanges +
    numTransitionCrossings
  const crossingDensity = totalCrossings / Math.max(nodeArea, 1)

  return {
    nodeArea,
    capacityRatio,
    viaAreaRatio,
    minDimensionRatio,
    crossingDensity,
  }
}

export const calculateNodeProbabilityOfFailure = (
  node: CapacityMeshNode,
  numSameLayerCrossings: number,
  numEntryExitLayerChanges: number,
  numTransitionCrossings: number,
  params: FailureModelParams = {},
): number => {
  if (node?._containsTarget) return 0

  const numLayers = node.availableZ?.length ?? 2

  if (
    numLayers === 1 &&
    (numSameLayerCrossings > 0 ||
      numEntryExitLayerChanges > 0 ||
      numTransitionCrossings > 0)
  ) {
    return 1
  }

  const viaDiameter = params.viaDiameter ?? DEFAULT_VIA_DIAMETER

  // Estimated number of vias based on crossings
  const sameLayerViaWeight = params.sameLayerViaWeight ?? 0.81
  const entryExitViaWeight = params.entryExitViaWeight ?? 0.36
  const transitionViaWeight = params.transitionViaWeight ?? 0.14
  const estNumVias =
    numSameLayerCrossings * sameLayerViaWeight +
    numEntryExitLayerChanges * entryExitViaWeight +
    numTransitionCrossings * transitionViaWeight
  const {
    nodeArea,
    capacityRatio,
    viaAreaRatio,
    minDimensionRatio,
    crossingDensity,
  } = getNodeFailureFeatures(
    node,
    estNumVias,
    numSameLayerCrossings,
    numEntryExitLayerChanges,
    numTransitionCrossings,
    viaDiameter,
  )

  const capacityWeight = params.capacityWeight ?? 1
  const viaAreaRatioWeight = params.viaAreaRatioWeight ?? 8
  const minDimensionRatioWeight = params.minDimensionRatioWeight ?? 0
  const crossingDensityWeight = params.crossingDensityWeight ?? -0.25
  const transitionWeight = params.transitionWeight ?? 0
  const areaAdjustment = getAreaBucketAdjustment(nodeArea)
  const areaAdjustmentWeight = params.areaAdjustmentWeight ?? 0.3
  const areaCapacityFactor = params.areaCapacityFactor ?? 0.25
  const areaViaAreaFactor = params.areaViaAreaFactor ?? 4
  const areaCrossingDensityFactor =
    params.areaCrossingDensityFactor ?? 0.5

  const areaAwareCapacityWeight =
    capacityWeight + areaAdjustment * areaCapacityFactor
  const areaAwareViaAreaRatioWeight =
    viaAreaRatioWeight + areaAdjustment * areaViaAreaFactor
  const areaAwareCrossingDensityWeight =
    crossingDensityWeight + areaAdjustment * areaCrossingDensityFactor

  const approxProb =
    capacityRatio * areaAwareCapacityWeight +
    viaAreaRatio * areaAwareViaAreaRatioWeight +
    minDimensionRatio * minDimensionRatioWeight +
    crossingDensity * areaAwareCrossingDensityWeight +
    numEntryExitLayerChanges * transitionWeight +
    areaAdjustment * areaAdjustmentWeight

  const scoreBias = params.scoreBias ?? 0
  const scoreExponent = params.scoreExponent ?? 1
  const biasedProb = clamp01(approxProb + scoreBias)

  return clamp01(biasedProb ** scoreExponent)
}

/**
 * Maps a boundary point to a 1D perimeter coordinate.
 * Starting at top-left corner, going clockwise:
 * - Top edge (y=ymax): t = x - xmin
 * - Right edge (x=xmax): t = W + (ymax - y)
 * - Bottom edge (y=ymin): t = 2W + H + (xmax - x)
 * - Left edge (x=xmin): t = 2W + 2H + (y - ymin)
 */
function perimeterT(
  p: { x: number; y: number },
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
): number {
  const W = xmax - xmin
  const H = ymax - ymin
  const eps = 1e-6

  // Top edge
  if (Math.abs(p.y - ymax) < eps) {
    return p.x - xmin
  }
  // Right edge
  if (Math.abs(p.x - xmax) < eps) {
    return W + (ymax - p.y)
  }
  // Bottom edge
  if (Math.abs(p.y - ymin) < eps) {
    return W + H + (xmax - p.x)
  }
  // Left edge
  if (Math.abs(p.x - xmin) < eps) {
    return 2 * W + H + (p.y - ymin)
  }

  // Point is not exactly on boundary - find closest edge
  const distTop = Math.abs(p.y - ymax)
  const distRight = Math.abs(p.x - xmax)
  const distBottom = Math.abs(p.y - ymin)
  const distLeft = Math.abs(p.x - xmin)

  const minDist = Math.min(distTop, distRight, distBottom, distLeft)

  if (minDist === distTop) {
    return Math.max(0, Math.min(W, p.x - xmin))
  }
  if (minDist === distRight) {
    return W + Math.max(0, Math.min(H, ymax - p.y))
  }
  if (minDist === distBottom) {
    return W + H + Math.max(0, Math.min(W, xmax - p.x))
  }
  // Left edge
  return 2 * W + H + Math.max(0, Math.min(H, p.y - ymin))
}

/**
 * Check if two perimeter coordinates are coincident (within epsilon)
 */
function areCoincident(t1: number, t2: number, eps: number = 1e-6): boolean {
  return Math.abs(t1 - t2) < eps
}

/**
 * Count necessary crossings between chords on a circle using the interleaving criterion.
 * Two chords (a,b) and (c,d) with a < b and c < d cross iff: a < c < b < d OR c < a < d < b
 *
 * Chords that share a coincident endpoint do NOT count as crossing.
 *
 * Uses O(n^2) algorithm to correctly handle coincident endpoints.
 */
function countChordCrossings(chords: Array<[number, number]>): number {
  if (chords.length < 2) return 0

  // Normalize each chord so first endpoint is smaller
  const normalizedChords = chords.map(([t1, t2]) =>
    t1 < t2 ? ([t1, t2] as [number, number]) : ([t2, t1] as [number, number]),
  )

  let crossings = 0

  // Check all pairs of chords
  for (let i = 0; i < normalizedChords.length; i++) {
    const [a, b] = normalizedChords[i]!
    for (let j = i + 1; j < normalizedChords.length; j++) {
      const [c, d] = normalizedChords[j]!

      // Skip if chords share a coincident endpoint
      if (
        areCoincident(a, c) ||
        areCoincident(a, d) ||
        areCoincident(b, c) ||
        areCoincident(b, d)
      ) {
        continue
      }

      // Two chords cross iff their endpoints interleave: a < c < b < d OR c < a < d < b
      if ((a < c && c < b && b < d) || (c < a && a < d && d < b)) {
        crossings++
      }
    }
  }

  return crossings
}

/**
 * Compute intra-node crossings using the circle/perimeter mapping approach.
 *
 * This is topologically correct: two connections MUST cross if their boundary
 * points interleave around the perimeter, regardless of which side of the
 * rectangle they are on.
 *
 * Returns the same output structure as getIntraNodeCrossings.
 */
export const getIntraNodeCrossingsUsingCircle = (node: NodeWithPortPoints) => {
  const xmin = node.center.x - node.width / 2
  const xmax = node.center.x + node.width / 2
  const ymin = node.center.y - node.height / 2
  const ymax = node.center.y + node.height / 2

  // Group port points by connectionName
  const connectionPointsMap = new Map<
    string,
    Array<{ x: number; y: number; z: number }>
  >()

  for (const pp of node.portPoints) {
    const points = connectionPointsMap.get(pp.connectionName) ?? []
    // Avoid duplicate points
    if (!points.some((p) => p.x === pp.x && p.y === pp.y && p.z === pp.z)) {
      points.push({ x: pp.x, y: pp.y, z: pp.z })
    }
    connectionPointsMap.set(pp.connectionName, points)
  }

  // Separate same-layer pairs from transition pairs
  const sameLayerPairsByZ = new Map<number, Array<[number, number]>>()
  const transitionPairs: Array<[number, number]> = []
  let numEntryExitLayerChanges = 0

  for (const [connectionName, points] of connectionPointsMap) {
    if (points.length < 2) continue

    // Get the two endpoints for this connection
    const p1 = points[0]!
    const p2 = points[1]!

    // Map to perimeter coordinates
    const t1 = perimeterT(p1, xmin, xmax, ymin, ymax)
    const t2 = perimeterT(p2, xmin, xmax, ymin, ymax)

    if (p1.z === p2.z) {
      // Same layer - add to the layer's chord list
      const z = p1.z
      const chords = sameLayerPairsByZ.get(z) ?? []
      chords.push([t1, t2])
      sameLayerPairsByZ.set(z, chords)
    } else {
      // Transition pair - different layers
      numEntryExitLayerChanges++
      transitionPairs.push([t1, t2])
    }
  }

  // Count same-layer crossings (per layer, then sum)
  let numSameLayerCrossings = 0
  for (const [z, chords] of sameLayerPairsByZ) {
    numSameLayerCrossings += countChordCrossings(chords)
  }

  // Count transition pair crossings
  // Transition pairs can cross each other regardless of layer
  const numTransitionPairCrossings = countChordCrossings(transitionPairs)

  return {
    numSameLayerCrossings,
    numEntryExitLayerChanges,
    numTransitionPairCrossings,
  }
}

type DatasetEntry = {
  fileName: string
  actual: 0 | 1
  pred: number
}

type PreparedProblem = {
  raw: NodeWithPortPoints
  actual: 0 | 1
  crossings: ReturnType<typeof getIntraNodeCrossingsUsingCircle>
}

type ConfusionMetrics = {
  precision: number
  recall: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
}

const round = (value: number, digits: number) =>
  Number(value.toFixed(digits))

const evaluateThreshold = (
  entries: DatasetEntry[],
  precisionThreshold: number,
): ConfusionMetrics => {
  let truePositives = 0
  let falsePositives = 0
  let falseNegatives = 0

  for (const entry of entries) {
    const predictedFail = entry.pred >= precisionThreshold
    const isActualFail = entry.actual === 1

    if (predictedFail && isActualFail) truePositives++
    if (predictedFail && !isActualFail) falsePositives++
    if (!predictedFail && isActualFail) falseNegatives++
  }

  const precision =
    truePositives + falsePositives === 0
      ? 0
      : truePositives / (truePositives + falsePositives)
  const recall =
    truePositives + falseNegatives === 0
      ? 0
      : truePositives / (truePositives + falseNegatives)

  return {
    precision,
    recall,
    truePositives,
    falsePositives,
    falseNegatives,
  }
}

const withScale = (
  params: FailureModelParams,
  scales: Partial<Record<keyof FailureModelParams, number>>,
): FailureModelParams => ({
  ...params,
  ...Object.fromEntries(
    Object.entries(scales).map(([key, scale]) => [
      key,
      (params[key as keyof FailureModelParams] ?? 0) * scale!,
    ]),
  ),
})

const main = async () => {
  const latest = (await readdir("results"))
    .filter((f) => f.endsWith(".json"))
    .sort(sortByNewest)[0]
  if (!latest) throw new Error("No result files found")

  const results = (await Bun.file(`results/${latest}`).json()) as SolveResult[]
  const baselineThreshold = 0.15
  const baselineModelParams: FailureModelParams = {
    viaDiameter: DEFAULT_VIA_DIAMETER,
    capacityWeight: 1.04,
    viaAreaRatioWeight: 8.35,
    minDimensionRatioWeight: 0,
    crossingDensityWeight: -0.35,
    transitionWeight: 0,
    areaAdjustmentWeight: 0.32,
    areaCapacityFactor: 0.4,
    areaViaAreaFactor: 5.25,
    areaCrossingDensityFactor: 0.5,
    sameLayerViaWeight: 0.81,
    entryExitViaWeight: 0.36,
    transitionViaWeight: 0.14,
    scoreBias: 0,
    scoreExponent: 1,
  }
  const script4BestParams: FailureModelParams = {
    viaDiameter: DEFAULT_VIA_DIAMETER,
    capacityWeight: 1.1232,
    viaAreaRatioWeight: 9.018,
    minDimensionRatioWeight: 0,
    crossingDensityWeight: -0.378,
    transitionWeight: 0,
    areaAdjustmentWeight: 0.2944,
    areaCapacityFactor: 0.368,
    areaViaAreaFactor: 4.83,
    areaCrossingDensityFactor: 0.5,
    sameLayerViaWeight: 0.81,
    entryExitViaWeight: 0.36,
    transitionViaWeight: 0.14,
    scoreBias: 0,
    scoreExponent: 1,
  }

  const preparedProblems: PreparedProblem[] = []

  for (const r of results) {
    try {
      readFileSync(`hg-problem/${r.fileName}`).toString()
    } catch (e) {
      console.warn(`Skipping ${r.fileName} - problem file not found`)
      continue
    }

    const raw = (await Bun.file(`hg-problem/${r.fileName}`).json()) as NodeWithPortPoints
    preparedProblems.push({
      raw,
      actual: r.didSolve ? 0 : 1,
      crossings: getIntraNodeCrossingsUsingCircle(raw),
    })
  }

  if (preparedProblems.length === 0) throw new Error("No valid problems to evaluate")

  const buildEntries = (params: FailureModelParams): DatasetEntry[] =>
    preparedProblems.map(({ raw, actual, crossings }, index) => {
      const pred = calculateNodeProbabilityOfFailure(
        {
          ...raw,
          layer: "",
          availableZ: raw.availableZ ?? [0, 1],
        },
        crossings.numSameLayerCrossings,
        crossings.numEntryExitLayerChanges,
        crossings.numTransitionPairCrossings,
        params,
      )

      return {
        fileName: String(index),
        actual,
        pred,
      }
    })

  const baselineEntries = buildEntries(baselineModelParams)
  const baselineMetrics = evaluateThreshold(baselineEntries, baselineThreshold)

  const scaleValues = [0.98, 1.02]
  const biasValues = [-0.01, 0, 0.01]
  const exponentValues = [0.96, 1, 1.04]
  const thresholdValues = Array.from({ length: 21 }, (_, i) => 0.1 + i * 0.01)
  const baseParamCandidates = [
    baselineModelParams,
    script4BestParams,
  ]

  let best = {
    params: baselineModelParams,
    threshold: baselineThreshold,
    metrics: baselineMetrics,
    improvedBoth: false,
  }

  for (const baseParams of baseParamCandidates) {
    for (const capacityScale of scaleValues) {
      for (const viaAreaScale of scaleValues) {
        for (const sameLayerViaScale of scaleValues) {
          for (const entryExitViaScale of scaleValues) {
            for (const transitionViaScale of scaleValues) {
              for (const scoreBias of biasValues) {
                for (const scoreExponent of exponentValues) {
                  const params = withScale(baseParams, {
                    capacityWeight: capacityScale,
                    viaAreaRatioWeight: viaAreaScale,
                    sameLayerViaWeight: sameLayerViaScale,
                    entryExitViaWeight: entryExitViaScale,
                    transitionViaWeight: transitionViaScale,
                  })
                  params.scoreBias = scoreBias
                  params.scoreExponent = scoreExponent
                  const entries = buildEntries(params)

                  for (const threshold of thresholdValues) {
                    const metrics = evaluateThreshold(entries, threshold)
                    const improvesBoth =
                      metrics.precision > baselineMetrics.precision &&
                      metrics.recall > baselineMetrics.recall
                    const sameMode = improvesBoth === best.improvedBoth

                    if (
                      improvesBoth && !best.improvedBoth ||
                      (sameMode && metrics.recall > best.metrics.recall) ||
                      (sameMode &&
                        metrics.recall === best.metrics.recall &&
                        metrics.precision > best.metrics.precision)
                    ) {
                      best = {
                        params,
                        threshold,
                        metrics,
                        improvedBoth: improvesBoth,
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  console.log({
    baseline: {
      precisionThreshold: baselineThreshold,
      precision: round(baselineMetrics.precision, 4),
      recall: round(baselineMetrics.recall, 4),
      truePositives: baselineMetrics.truePositives,
      falsePositives: baselineMetrics.falsePositives,
      falseNegatives: baselineMetrics.falseNegatives,
    },
    best: {
      improvedBoth: best.improvedBoth,
      precisionThreshold: round(best.threshold, 4),
      precision: round(best.metrics.precision, 4),
      recall: round(best.metrics.recall, 4),
      truePositives: best.metrics.truePositives,
      falsePositives: best.metrics.falsePositives,
      falseNegatives: best.metrics.falseNegatives,
      modelParams: Object.fromEntries(
        Object.entries(best.params).map(([key, value]) => [key, round(value!, 4)]),
      ),
    },
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
