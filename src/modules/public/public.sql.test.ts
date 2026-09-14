import { buildMapProjectsQuery } from './public.sql.js'

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    pass += 1
    console.log(`  ok   ${name}`)
  } else {
    fail += 1
    console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`)
  }
}

console.log('buildMapProjectsQuery()\n')

{
  const { sql, params } = buildMapProjectsQuery()
  check('published filter always present', sql.includes(`p."PublicationStatus" = 'Published'`))
  check('no params without filters', params.length === 0, JSON.stringify(params))
  check('default order is featured then newest', sql.includes('ORDER BY p."IsFeatured" DESC, p."CreatedAt" DESC'))
  check('selects show highlight columns', sql.includes('p."IsShowHighlight"') && sql.includes('p."ShowOrder"'))
  check('selects featured media', sql.includes('AS "FeaturedMediaUrl"') && sql.includes('AS "FeaturedMediaType"') && sql.includes('AS "FeaturedThumbnailUrl"'))
  check('selects Has360', sql.includes('AS "Has360"') && sql.includes(`'360_VIDEO'`) && sql.includes(`'360_IMAGE'`))
  check('highlight filter absent by default', !sql.includes('p."IsShowHighlight" = TRUE'))
}

{
  const { sql, params } = buildMapProjectsQuery({ county: 'Nairobi', status: 'Ongoing' })
  check('county filter', sql.includes('LOWER(pl."County") = LOWER(@county)'))
  check('status filter', sql.includes('p."ProjectStatus" = @status'))
  check('county + status params', JSON.stringify(params) === JSON.stringify([
    { name: 'county', value: 'Nairobi' },
    { name: 'status', value: 'Ongoing' },
  ]), JSON.stringify(params))
}

{
  const { sql, params } = buildMapProjectsQuery({ county: 'All', status: 'All' })
  check('"All" adds no filters', params.length === 0 && !sql.includes('@county') && !sql.includes('@status'))
}

{
  const { sql } = buildMapProjectsQuery({ highlights: true })
  check('highlight filter', sql.includes('p."IsShowHighlight" = TRUE'))
  check('highlight order', sql.includes('ORDER BY p."ShowOrder" ASC NULLS LAST, p."ProjectName" ASC'))
}

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
