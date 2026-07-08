import {
  Box,
  Button,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { useCallback, useMemo, useState } from 'react'
import CodeEditor from '../../components/CodeEditor'
import { useRequestEditor } from '../../contexts/RequestEditorContext'

type SchemaType = {
  kind: string
  name: string
  fields?: Array<{ name: string; type: { kind: string; name?: string; ofType?: { kind: string; name?: string } } }>
}

type IntrospectionData = {
  __schema?: {
    queryType?: { name: string }
    types?: SchemaType[]
  }
}

function typeLabel(type: {
  kind: string
  name?: string
  ofType?: { kind: string; name?: string; ofType?: { kind: string; name?: string } }
}): string {
  if (type.kind === 'NON_NULL') return `${typeLabel(type.ofType!)}!`
  if (type.kind === 'LIST') return `[${typeLabel(type.ofType!)}]`
  return type.name || type.kind
}

function GraphQLSchemaExplorer({
  schema,
  onInsertField
}: {
  schema: IntrospectionData
  onInsertField: (field: string) => void
}) {
  const [openTypes, setOpenTypes] = useState<Record<string, boolean>>({})

  const objectTypes = useMemo(() => {
    const types = schema.__schema?.types || []
    return types.filter(
      (t) =>
        t.kind === 'OBJECT' &&
        !t.name.startsWith('__') &&
        (t.fields?.length ?? 0) > 0
    )
  }, [schema])

  const queryTypeName = schema.__schema?.queryType?.name
  const sortedTypes = useMemo(() => {
    return [...objectTypes].sort((a, b) => {
      if (a.name === queryTypeName) return -1
      if (b.name === queryTypeName) return 1
      return a.name.localeCompare(b.name)
    })
  }, [objectTypes, queryTypeName])

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        maxHeight: 220,
        overflow: 'auto',
        mb: 1,
        bgcolor: 'background.paper'
      }}
    >
      <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.5, fontWeight: 700 }}>
        Schema Explorer
      </Typography>
      <List dense disablePadding>
        {sortedTypes.map((type) => {
          const isOpen = openTypes[type.name] ?? type.name === queryTypeName
          return (
            <Box key={type.name}>
              <ListItemButton
                sx={{ py: 0.25 }}
                onClick={() => setOpenTypes((prev) => ({ ...prev, [type.name]: !isOpen }))}
              >
                {isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                <ListItemText
                  primary={type.name}
                  secondary={`${type.fields?.length || 0} fields`}
                  primaryTypographyProps={{ variant: 'caption', fontWeight: 600 }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
              <Collapse in={isOpen}>
                {type.fields?.map((field) => (
                  <ListItemButton
                    key={field.name}
                    sx={{ pl: 4, py: 0.15 }}
                    onClick={() => onInsertField(field.name)}
                  >
                    <ListItemText
                      primary={field.name}
                      secondary={typeLabel(field.type)}
                      primaryTypographyProps={{ variant: 'caption', fontFamily: 'monospace' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                ))}
              </Collapse>
            </Box>
          )
        })}
      </List>
    </Box>
  )
}

export default function GraphQLTab() {
  const { request, patch, flush } = useRequestEditor()
  const [schema, setSchema] = useState<IntrospectionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patchQuery = useCallback((graphqlQuery: string) => patch({ graphqlQuery }), [patch])
  const patchVariables = useCallback(
    (graphqlVariables: string) => patch({ graphqlVariables }),
    [patch]
  )

  const introspect = async () => {
    flush()
    if (!request.url) return
    setLoading(true)
    setError(null)
    try {
      const result = (await window.lisek.graphql.introspect(request.url, request.headers)) as IntrospectionData
      setSchema(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSchema(null)
    } finally {
      setLoading(false)
    }
  }

  const insertField = (field: string) => {
    const current = request.graphqlQuery.trim()
    if (!current || current === '# Write your query here') {
      patch({ graphqlQuery: `{\n  ${field}\n}` })
      return
    }
    if (current.includes(field)) return
    const insertion = current.endsWith('}') ? current.slice(0, -1) + `  ${field}\n}` : `${current}\n  ${field}`
    patch({ graphqlQuery: insertion })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={request.graphqlOperationType || 'query'}
          onChange={(_, value) => value && patch({ graphqlOperationType: value })}
        >
          <ToggleButton value="query">Query</ToggleButton>
          <ToggleButton value="subscription">Subscription</ToggleButton>
        </ToggleButtonGroup>
        <Button size="small" onClick={() => void introspect()} disabled={loading || !request.url}>
          {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
          Introspect Schema
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 1, py: 0 }}>
          {error}
        </Alert>
      )}
      {schema && <GraphQLSchemaExplorer schema={schema} onInsertField={insertField} />}
      <CodeEditor
        height="180px"
        language="graphql"
        value={request.graphqlQuery}
        onChange={patchQuery}
      />
      <CodeEditor
        height="100px"
        language="json"
        value={request.graphqlVariables}
        onChange={patchVariables}
      />
    </Box>
  )
}
