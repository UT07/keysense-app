/**
 * SkillTree — Directed Acyclic Graph of piano skills
 *
 * Defines the learning path from individual notes through intervals, scales,
 * chords, and songs. Each node has prerequisites, mapped exercises, and a
 * mastery threshold. Pure TypeScript — no React imports.
 */

// ============================================================================
// Types
// ============================================================================

export type SkillCategory =
  | 'note-finding'
  | 'intervals'
  | 'scales'
  | 'chords'
  | 'rhythm'
  | 'hand-independence'
  | 'songs';

export interface SkillNode {
  id: string;
  name: string;
  category: SkillCategory;
  prerequisites: string[];
  targetExerciseIds: string[];
  masteryThreshold: number; // 0-1, score needed to consider mastered
  description: string;
}

// ============================================================================
// Skill Tree Definition
// ============================================================================

export const SKILL_TREE: SkillNode[] = [
  // ── Note Finding (Lesson 1) ──────────────────────────────────────────────
  {
    id: 'find-middle-c',
    name: 'Find Middle C',
    category: 'note-finding',
    prerequisites: [],
    targetExerciseIds: ['lesson-01-ex-01'],
    masteryThreshold: 0.7,
    description: 'Locate and play Middle C (C4) on the keyboard',
  },
  {
    id: 'keyboard-geography',
    name: 'Keyboard Geography',
    category: 'note-finding',
    prerequisites: ['find-middle-c'],
    targetExerciseIds: ['lesson-01-ex-02'],
    masteryThreshold: 0.7,
    description: 'Navigate the white keys around Middle C',
  },
  {
    id: 'white-keys',
    name: 'White Keys',
    category: 'note-finding',
    prerequisites: ['keyboard-geography'],
    targetExerciseIds: ['lesson-01-ex-03'],
    masteryThreshold: 0.7,
    description: 'Play all white keys in the C4 octave',
  },

  // ── Right Hand Melodies (Lesson 2) ────────────────────────────────────────
  {
    id: 'rh-cde',
    name: 'C-D-E Right Hand',
    category: 'intervals',
    prerequisites: ['white-keys'],
    targetExerciseIds: ['lesson-02-ex-01'],
    masteryThreshold: 0.7,
    description: 'Play C-D-E ascending with right hand',
  },
  {
    id: 'rh-cdefg',
    name: 'C Position (C-G)',
    category: 'intervals',
    prerequisites: ['rh-cde'],
    targetExerciseIds: ['lesson-02-ex-02'],
    masteryThreshold: 0.7,
    description: 'Play five-finger C position with right hand',
  },
  {
    id: 'c-major-octave',
    name: 'C Major Octave',
    category: 'scales',
    prerequisites: ['rh-cdefg'],
    targetExerciseIds: ['lesson-02-ex-03'],
    masteryThreshold: 0.7,
    description: 'Play the full C major scale ascending',
  },
  {
    id: 'simple-melodies',
    name: 'Simple Melodies',
    category: 'songs',
    prerequisites: ['rh-cdefg'],
    targetExerciseIds: ['lesson-02-ex-04', 'lesson-02-ex-06'],
    masteryThreshold: 0.7,
    description: 'Play simple right-hand melodies (Mary, Twinkle)',
  },
  {
    id: 'eighth-notes',
    name: 'Eighth Notes',
    category: 'rhythm',
    prerequisites: ['rh-cde'],
    targetExerciseIds: ['lesson-02-ex-07'],
    masteryThreshold: 0.7,
    description: 'Play eighth-note rhythms accurately',
  },
  {
    id: 'broken-chords-rh',
    name: 'Broken Chords (RH)',
    category: 'chords',
    prerequisites: ['rh-cdefg'],
    targetExerciseIds: ['lesson-02-ex-05'],
    masteryThreshold: 0.7,
    description: 'Play broken C chord with right hand',
  },
  {
    id: 'c-position-review',
    name: 'C Position Review',
    category: 'intervals',
    prerequisites: ['c-major-octave', 'eighth-notes'],
    targetExerciseIds: ['lesson-02-ex-08'],
    masteryThreshold: 0.8,
    description: 'Comprehensive C position review',
  },

  // ── Left Hand Basics (Lesson 3) ──────────────────────────────────────────
  {
    id: 'lh-c-position',
    name: 'Left Hand C Position',
    category: 'note-finding',
    prerequisites: ['white-keys'],
    targetExerciseIds: ['lesson-03-ex-01'],
    masteryThreshold: 0.7,
    description: 'Play C position with left hand',
  },
  {
    id: 'lh-scale-descending',
    name: 'Left Hand Scale Down',
    category: 'scales',
    prerequisites: ['lh-c-position'],
    targetExerciseIds: ['lesson-03-ex-02'],
    masteryThreshold: 0.7,
    description: 'Play descending C major scale with left hand',
  },
  {
    id: 'bass-notes',
    name: 'Bass Notes',
    category: 'note-finding',
    prerequisites: ['lh-c-position'],
    targetExerciseIds: ['lesson-03-ex-03'],
    masteryThreshold: 0.7,
    description: 'Play bass register notes with left hand',
  },
  {
    id: 'broken-chords-lh',
    name: 'Broken Chords (LH)',
    category: 'chords',
    prerequisites: ['lh-scale-descending'],
    targetExerciseIds: ['lesson-03-ex-04'],
    masteryThreshold: 0.7,
    description: 'Play broken F chord with left hand',
  },
  {
    id: 'steady-bass',
    name: 'Steady Bass Pattern',
    category: 'rhythm',
    prerequisites: ['bass-notes'],
    targetExerciseIds: ['lesson-03-ex-05'],
    masteryThreshold: 0.7,
    description: 'Maintain a steady bass rhythm pattern',
  },

  // ── Both Hands Together (Lesson 4) ────────────────────────────────────────
  {
    id: 'hands-together-basic',
    name: 'Hands Together Basic',
    category: 'hand-independence',
    prerequisites: ['c-position-review', 'lh-scale-descending'],
    targetExerciseIds: ['lesson-04-ex-01'],
    masteryThreshold: 0.7,
    description: 'Play simple melody + bass simultaneously',
  },
  {
    id: 'hands-melody-full',
    name: 'Full Two-Hand Melody',
    category: 'hand-independence',
    prerequisites: ['hands-together-basic'],
    targetExerciseIds: ['lesson-04-ex-02'],
    masteryThreshold: 0.7,
    description: 'Play a full melody with both hands (Mary Had a Little Lamb)',
  },
  {
    id: 'hand-independence-drill',
    name: 'Hand Independence Drill',
    category: 'hand-independence',
    prerequisites: ['hands-together-basic'],
    targetExerciseIds: ['lesson-04-ex-03'],
    masteryThreshold: 0.75,
    description: 'Different rhythms in each hand simultaneously',
  },
  {
    id: 'two-hand-songs',
    name: 'Two-Hand Songs',
    category: 'songs',
    prerequisites: ['hands-melody-full'],
    targetExerciseIds: ['lesson-04-ex-04'],
    masteryThreshold: 0.7,
    description: 'Play arranged songs with both hands (Ode to Joy)',
  },
  {
    id: 'blocked-chords',
    name: 'Blocked Chords',
    category: 'chords',
    prerequisites: ['broken-chords-rh', 'broken-chords-lh'],
    targetExerciseIds: ['lesson-04-ex-05'],
    masteryThreshold: 0.7,
    description: 'Play C and F chords in blocked form',
  },
  {
    id: 'both-hands-review',
    name: 'Both Hands Review',
    category: 'hand-independence',
    prerequisites: ['hand-independence-drill', 'blocked-chords'],
    targetExerciseIds: ['lesson-04-ex-06'],
    masteryThreshold: 0.8,
    description: 'Comprehensive both-hands review',
  },

  // ── Scales & Technique (Lesson 5) ─────────────────────────────────────────
  {
    id: 'scale-technique',
    name: 'Scale Technique',
    category: 'scales',
    prerequisites: ['c-major-octave', 'lh-scale-descending'],
    targetExerciseIds: ['lesson-05-ex-01'],
    masteryThreshold: 0.75,
    description: 'Proper thumb-under technique for scales',
  },
  {
    id: 'parallel-scales',
    name: 'Parallel Scales',
    category: 'scales',
    prerequisites: ['scale-technique', 'hands-together-basic'],
    targetExerciseIds: ['lesson-05-ex-02'],
    masteryThreshold: 0.75,
    description: 'Play scales in parallel motion with both hands',
  },
  {
    id: 'scale-speed',
    name: 'Scale Speed',
    category: 'scales',
    prerequisites: ['parallel-scales'],
    targetExerciseIds: ['lesson-05-ex-03'],
    masteryThreshold: 0.75,
    description: 'Increase scale speed while maintaining accuracy',
  },
  {
    id: 'scale-review',
    name: 'Scale Review',
    category: 'scales',
    prerequisites: ['scale-speed'],
    targetExerciseIds: ['lesson-05-ex-04'],
    masteryThreshold: 0.8,
    description: 'Comprehensive scale technique review',
  },

  // ── Popular Songs (Lesson 6) ──────────────────────────────────────────────
  {
    id: 'beginner-songs',
    name: 'Beginner Songs',
    category: 'songs',
    prerequisites: ['both-hands-review'],
    targetExerciseIds: ['lesson-06-ex-01', 'lesson-06-ex-02'],
    masteryThreshold: 0.7,
    description: 'Play well-known songs (Jingle Bells, Happy Birthday)',
  },
  {
    id: 'intermediate-songs',
    name: 'Intermediate Songs',
    category: 'songs',
    prerequisites: ['beginner-songs', 'scale-technique'],
    targetExerciseIds: ['lesson-06-ex-03', 'lesson-06-ex-04'],
    masteryThreshold: 0.75,
    description: 'Play more complex arrangements (Amazing Grace, Let It Go)',
  },
];

// ============================================================================
// Query Functions
// ============================================================================

/** Look up a skill node by ID. Returns null if not found. */
export function getSkillById(id: string): SkillNode | null {
  return SKILL_TREE.find((node) => node.id === id) ?? null;
}

/**
 * Return all skill nodes whose prerequisites have ALL been mastered.
 * If `masteredIds` is empty, returns root nodes (no prerequisites).
 */
export function getAvailableSkills(masteredIds: string[]): SkillNode[] {
  const masteredSet = new Set(masteredIds);
  return SKILL_TREE.filter(
    (node) =>
      !masteredSet.has(node.id) &&
      node.prerequisites.every((prereq) => masteredSet.has(prereq))
  );
}

/** Return all skill nodes that list a given exercise ID as a target. */
export function getSkillsForExercise(exerciseId: string): SkillNode[] {
  return SKILL_TREE.filter((node) =>
    node.targetExerciseIds.includes(exerciseId)
  );
}

/** Return all skill nodes in a given category. */
export function getSkillsByCategory(category: SkillCategory): SkillNode[] {
  return SKILL_TREE.filter((node) => node.category === category);
}

/**
 * Validate that the skill tree is a valid DAG (no cycles).
 * Returns true if valid, throws Error with cycle description if not.
 */
export function validateSkillTree(): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const nodeMap = new Map(SKILL_TREE.map((n) => [n.id, n]));

  function dfs(nodeId: string): void {
    if (inStack.has(nodeId)) {
      throw new Error(`Cycle detected involving skill: ${nodeId}`);
    }
    if (visited.has(nodeId)) return;

    inStack.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) {
      for (const prereq of node.prerequisites) {
        dfs(prereq);
      }
    }
    inStack.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of SKILL_TREE) {
    dfs(node.id);
  }
  return true;
}

/**
 * Return the topological depth of a skill node (longest path from a root).
 * Root nodes have depth 0.
 */
export function getSkillDepth(skillId: string): number {
  const nodeMap = new Map(SKILL_TREE.map((n) => [n.id, n]));
  const cache = new Map<string, number>();

  function depth(id: string): number {
    if (cache.has(id)) return cache.get(id)!;
    const node = nodeMap.get(id);
    if (!node || node.prerequisites.length === 0) {
      cache.set(id, 0);
      return 0;
    }
    const d = 1 + Math.max(...node.prerequisites.map(depth));
    cache.set(id, d);
    return d;
  }

  return depth(skillId);
}
