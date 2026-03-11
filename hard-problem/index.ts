import hardProblem2100 from "../hg-problem/2100.json";
import hardProblem2133 from "../hg-problem/2133.json";
import hardProblem2377 from "../hg-problem/2377.json";
import hardProblem3230 from "../hg-problem/3230.json";
import hardProblem3640 from "../hg-problem/3640.json";
import hardProblem4390 from "../hg-problem/4390.json";
import hardProblem4822 from "../hg-problem/4822.json";
import hardProblem4911 from "../hg-problem/4911.json";
import hardProblem4915 from "../hg-problem/4915.json";
import hardProblem5045 from "../hg-problem/5045.json";
import hardProblem5572 from "../hg-problem/5572.json";
import hardProblem5663 from "../hg-problem/5663.json";
import hardProblem6025 from "../hg-problem/6025.json";
import hardProblem6192 from "../hg-problem/6192.json";

export const hardProblemMap = {
  2100: hardProblem2100,
  2133: hardProblem2133,
  2377: hardProblem2377,
  3230: hardProblem3230,
  3640: hardProblem3640,
  4390: hardProblem4390,
  4822: hardProblem4822,
  4911: hardProblem4911,
  4915: hardProblem4915,
  5045: hardProblem5045,
  5572: hardProblem5572,
  5663: hardProblem5663,
  6025: hardProblem6025,
  6192: hardProblem6192,
} as const;

export const hardProblems = [
  { id: 2100, data: hardProblem2100 },
  { id: 2133, data: hardProblem2133 },
  { id: 2377, data: hardProblem2377 },
  { id: 3230, data: hardProblem3230 },
  { id: 3640, data: hardProblem3640 },
  { id: 4390, data: hardProblem4390 },
  { id: 4822, data: hardProblem4822 },
  { id: 4911, data: hardProblem4911 },
  { id: 4915, data: hardProblem4915 },
  { id: 5045, data: hardProblem5045 },
  { id: 5572, data: hardProblem5572 },
  { id: 5663, data: hardProblem5663 },
  { id: 6025, data: hardProblem6025 },
  { id: 6192, data: hardProblem6192 },
] as const;

export default hardProblemMap;
export {
  hardProblem2100,
  hardProblem2133,
  hardProblem2377,
  hardProblem3230,
  hardProblem3640,
  hardProblem4390,
  hardProblem4822,
  hardProblem4911,
  hardProblem4915,
  hardProblem5045,
  hardProblem5572,
  hardProblem5663,
  hardProblem6025,
  hardProblem6192,
};
