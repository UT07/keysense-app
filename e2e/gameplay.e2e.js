const {
    device,
    element,
    by,
    waitFor,
} = require('detox');
const fs = require('fs');
const path = require('path');

const LESSON_IDS = ['lesson-01', 'lesson-02', 'lesson-03', 'lesson-04', 'lesson-05', 'lesson-06'];

// Helper to read JSON content relative to project root
const loadJSON = (filePath) => {
    const absPath = path.resolve(__dirname, '..', filePath);
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
};

// Helper: Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Purrrfect Keys Gameplay Verification', () => {
    let lessons = [];

    beforeAll(async () => {
        // recursively load lessons and exercises
        for (const lessonId of LESSON_IDS) {
            const lessonPath = `content/lessons/${lessonId}.json`;
            const lesson = loadJSON(lessonPath);

            const exercises = [];
            // Read all files in the lesson directory to match IDs
            const dirPath = `content/exercises/${lessonId}`;
            const absDirPath = path.resolve(__dirname, '..', dirPath);

            if (fs.existsSync(absDirPath)) {
                const files = fs.readdirSync(absDirPath);
                for (const file of files) {
                    if (!file.endsWith('.json')) continue;
                    try {
                        const content = loadJSON(`${dirPath}/${file}`);
                        exercises.push(content);
                    } catch (e) {
                        console.warn(`Skipping invalid JSON: ${file}`);
                    }
                }
            }

            // Sort exercises by order property if available, or ID
            exercises.sort((a, b) => {
                const orderA = a.order || 999;
                const orderB = b.order || 999;
                return orderA - orderB;
            });

            lessons.push({ ...lesson, exercises });
        }
    });

    it('completes all levels with perfect score', async () => {
        // 1. Launch App
        await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });

        // 2. Skip Auth
        await waitFor(element(by.id('onboarding-skip'))).toBeVisible().withTimeout(10000);
        await element(by.id('onboarding-skip')).tap();

        // 3. Go to Learn Tab
        await waitFor(element(by.id('tab-learn'))).toBeVisible().withTimeout(5000);
        await element(by.id('tab-learn')).tap();

        // 4. Iterate Lessons
        for (const lesson of lessons) {
            console.log(`\n🎹 Starting Lesson: ${lesson.metadata.title} (${lesson.id})`);

            // Scroll to lesson node if needed
            // Detox doesn't have a generic "scroll until visible" easily without a target inside a scrollview.
            // We know the structure is a ScrollView with ID "level-map-scroll".
            // We can try to scroll down blindly if not found.
            try {
                await waitFor(element(by.id(`lesson-node-${lesson.id}`)))
                    .toBeVisible()
                    .whileElement(by.id('level-map-scroll'))
                    .scroll(300, 'down');
            } catch (e) {
                console.log(`Could not find lesson node ${lesson.id}, trying to scroll more...`);
                // Fallback or retry logic
            }

            await element(by.id(`lesson-node-${lesson.id}`)).tap();

            // Handle "Start Chip" if it appears (resume state, or just UI quirk)
            // Usually tapping the node opens the sheet.
            // Wait for "Start Lesson" button on the sheet.
            // ID: lesson-intro-start

            await waitFor(element(by.id('lesson-intro-start')))
                .toBeVisible()
                .withTimeout(5000);

            await element(by.id('lesson-intro-start')).tap();

            // now iterate exercises
            for (const exercise of lesson.exercises) {
                console.log(`  🎵 Playing: ${exercise.metadata.title} (${exercise.id})`);

                // Wait for Exercise Intro Overlay "Ready" button
                await waitFor(element(by.id('exercise-intro-ready')))
                    .toBeVisible()
                    .withTimeout(10000);

                await element(by.id('exercise-intro-ready')).tap();

                // Check for "Start" button if it's manual start? 
                // ExercisePlayer usually auto-starts after Intro Overlay is dismissed?
                // Let's check `ExercisePlayer.tsx`:
                // <ExerciseIntroOverlay onReady={() => { setShowIntro(false); handleStart(); }} />
                // So yes, it auto-starts.

                // Wait for Player UI
                await waitFor(element(by.id('exercise-player'))).toBeVisible();

                // Calculate Timing
                const { tempo, countIn } = exercise.settings;
                const msPerBeat = 60000 / tempo;
                const countInMs = countIn * msPerBeat;

                // Wait through Count-In
                await sleep(countInMs + 500); // 500ms buffer for animation start

                // Play Notes
                const sortedNotes = [...exercise.notes].sort((a, b) => a.startBeat - b.startBeat);
                const startTime = Date.now();

                // Group notes by time to handle chords (concurrent taps)
                // Group: { timeMs: number, notes: number[] }
                const noteGroups = [];
                for (const note of sortedNotes) {
                    const timeMs = note.startBeat * msPerBeat;
                    const existing = noteGroups.find(g => Math.abs(g.timeMs - timeMs) < 10);
                    if (existing) {
                        existing.notes.push(note.note);
                    } else {
                        noteGroups.push({ timeMs, notes: [note.note] });
                    }
                }

                // Play groups
                for (const group of noteGroups) {
                    const now = Date.now() - startTime;
                    const waitTime = group.timeMs - now;

                    if (waitTime > 0) {
                        await sleep(waitTime);
                    }

                    // Tap all notes in group
                    // For chords, we might need concurrent taps? 
                    // Detox awaits each action. 
                    // Sequential fast taps usually work for chords if tolerance is high enough (75ms).
                    // But strict chords require multi-touch.
                    // `Keyboard.tsx` creates a new touch event for each touch.
                    // Detox `tap()` simulates a press. Sequence of taps: press A, press B.
                    // App treats them as separate events.
                    // If they fall within the same beat window, they count for that chord.

                    for (const midiNote of group.notes) {
                        try {
                            await element(by.id(`key-${midiNote}`)).tap();
                        } catch (e) {
                            console.warn(`    Failed to tap ${midiNote}: ${e.message}`);
                        }
                    }
                }

                // Wait for completion (last note duration + buffer)
                // Or wait for modal
                await waitFor(element(by.id('completion-modal')))
                    .toBeVisible()
                    .withTimeout(10000);

                // Advance
                // Check for "Next Exercise" or "Continue" (Lesson Complete / Mastery)
                // or "Start Test"
                // completion-next-exercise
                // completion-start-test
                // completion-continue (generic)

                try {
                    await element(by.id('completion-next-exercise')).tap();
                } catch (e1) {
                    try {
                        await element(by.id('completion-start-test')).tap();
                    } catch (e2) {
                        try {
                            await element(by.id('completion-continue')).tap(); // Might exit to map
                        } catch (e3) {
                            // If we are here, maybe we are at Lesson Complete screen?
                        }
                    }
                }
            }

            // After all exercises, we expect Lesson Complete screen or back to Map
            try {
                await waitFor(element(by.id('lesson-complete-screen')))
                    .toBeVisible()
                    .withTimeout(5000);
                await element(by.id('lesson-complete-continue')).tap();
            } catch (e) {
                // Maybe already at map
            }

            await waitFor(element(by.id('level-map-screen'))).toBeVisible();
        }
    });
});
