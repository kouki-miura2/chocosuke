import type { Mutation, Owner, SqlValue, WriteDao } from 'backend/src/dao/write.interface.ts'

/** Column and table names are written by code, never taken from input; this guards against mistakes. */
const identifier = (name: string): string => {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`invalid SQL identifier: ${name}`)
  return name
}

const counterTable = (owner: Owner) => (owner.scope === 'personal' ? 'users' : 'groups')

/** The owner's revision, read inside the batch after its bump. */
const revOf = (owner: Owner) => `(SELECT rev FROM ${counterTable(owner)} WHERE id = ?)`

const whereClause = (where: Record<string, SqlValue>) => {
  const entries = Object.entries(where)
  return {
    sql: entries
      .map(([column, value]) => `${identifier(column)} ${value === null ? 'IS NULL' : '= ?'}`)
      .join(' AND '),
    params: entries.flatMap(([, value]) => (value === null ? [] : [value])),
  }
}

export const createWriteDao = (db: D1Database): WriteDao => {
  const statement = (mutation: Mutation): D1PreparedStatement => {
    switch (mutation.kind) {
      case 'insert': {
        const columns = Object.keys(mutation.values).map(identifier)
        const values = columns.map(() => '?')
        const params: unknown[] = Object.values(mutation.values)
        if (mutation.revOf) {
          columns.push('rev')
          values.push(revOf(mutation.revOf))
          params.push(mutation.revOf.id)
        }
        return db
          .prepare(
            `INSERT INTO ${identifier(mutation.table)} (${columns.join(', ')}) VALUES (${values.join(', ')})`,
          )
          .bind(...params)
      }
      case 'update': {
        const sets = Object.keys(mutation.set).map((column) => `${identifier(column)} = ?`)
        const params: unknown[] = Object.values(mutation.set)
        if (mutation.revOf) {
          sets.push(`rev = ${revOf(mutation.revOf)}`)
          params.push(mutation.revOf.id)
        }
        const where = whereClause(mutation.where)
        return db
          .prepare(`UPDATE ${identifier(mutation.table)} SET ${sets.join(', ')} WHERE ${where.sql}`)
          .bind(...params, ...where.params)
      }
      case 'joinGroup':
        return db
          .prepare(
            `UPDATE users SET group_id = ?, member_name = ?, joined_at = ?
             WHERE id = ? AND group_id IS NULL AND deleted_at IS NULL
               AND (SELECT COUNT(*) FROM users WHERE group_id = ? AND deleted_at IS NULL) < ?`,
          )
          .bind(
            mutation.groupId,
            mutation.memberName,
            mutation.joinedAt,
            mutation.userId,
            mutation.groupId,
            mutation.maxMembers,
          )
    }
  }

  return {
    commit: async (bumps, mutations) => {
      const uniqueBumps = [
        ...new Map(bumps.map((owner) => [`${owner.scope}:${owner.id}`, owner])).values(),
      ]
      const statements = [
        ...uniqueBumps.map((owner) =>
          db.prepare(`UPDATE ${counterTable(owner)} SET rev = rev + 1 WHERE id = ?`).bind(owner.id),
        ),
        ...mutations.map(statement),
      ]
      if (statements.length === 0) return []
      // One batch is one transaction: the bumps and the rows they stamp land together or not at all.
      const results = await db.batch(statements)
      return results.slice(uniqueBumps.length).map((result) => result.meta.changes)
    },
  }
}
