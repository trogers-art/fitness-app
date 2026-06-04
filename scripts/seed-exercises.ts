/**
 * seed-exercises.ts
 * Run once: npm run db:seed-exercises
 * Pulls free-exercise-db JSON and seeds the exercises table.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EXERCISE_DB_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'

// Map free-exercise-db categories to our muscle_group enum
const MUSCLE_MAP: Record<string, string> = {
  'chest': 'chest',
  'back': 'back',
  'shoulders': 'shoulders',
  'upper arms': 'biceps',
  'lower arms': 'forearms',
  'upper legs': 'quads',
  'lower legs': 'calves',
  'waist': 'core',
  'hips': 'glutes',
  'cardio': 'cardio',
}

const EQUIPMENT_MAP: Record<string, string> = {
  'barbell': 'barbell',
  'dumbbell': 'dumbbell',
  'kettlebell': 'kettlebell',
  'cable': 'cable',
  'machine': 'machine',
  'body weight': 'bodyweight',
  'band': 'resistance_band',
  'leverage machine': 'machine',
  'assisted': 'machine',
  'weighted': 'dumbbell',
  'smith machine': 'barbell',
  'ez barbell': 'barbell',
  'olympic barbell': 'barbell',
  'trap bar': 'barbell',
  'rope': 'cable',
  'bosu ball': 'other',
  'stability ball': 'other',
  'foam roll': 'other',
  'medicine ball': 'other',
  'roller': 'other',
  'wheel roller': 'other',
}

interface RawExercise {
  name: string
  category: string
  force: string | null
  level: string
  mechanic: string | null
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  id: string
  images: string[]
}

async function seed() {
  console.log('Fetching exercise database...')
  const res = await fetch(EXERCISE_DB_URL)
  if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`)
  const exercises = await res.json() as RawExercise[]
  console.log(`Fetched ${exercises.length} exercises`)

  // Check existing count
  const { count } = await supabase.from('exercises').select('*', { count: 'exact', head: true }).is('user_id', null)
  if ((count ?? 0) > 0) {
    console.log(`${count} exercises already seeded. Skipping.`)
    return
  }

  const BATCH_SIZE = 50
  let inserted = 0

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE).map(ex => {
      const muscleGroup = MUSCLE_MAP[ex.category.toLowerCase()] || 'full_body'
      const equipment = ex.equipment ? [EQUIPMENT_MAP[ex.equipment.toLowerCase()] || 'other'] : ['bodyweight']
      const type = ex.mechanic === 'compound' ? 'compound' : ex.category === 'cardio' ? 'cardio' : 'isolation'

      // GIF URL pattern from free-exercise-db
      const gifUrl = ex.images.length > 0
        ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${ex.id}/${ex.images[0]}`
        : null

      return {
        name: ex.name,
        muscle_group: muscleGroup,
        secondary_muscles: ex.secondaryMuscles.map(m => MUSCLE_MAP[m.toLowerCase()] || m),
        equipment,
        type,
        instructions: ex.instructions,
        gif_url: gifUrl,
        source: 'free-exercise-db',
        user_id: null,
      }
    })

    const { error } = await supabase.from('exercises').insert(batch)
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} error:`, error.message)
    } else {
      inserted += batch.length
      console.log(`Inserted ${inserted}/${exercises.length}`)
    }
  }

  console.log(`Done. Seeded ${inserted} exercises.`)
}

seed().catch(console.error)
