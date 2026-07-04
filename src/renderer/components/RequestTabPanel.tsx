import { Box, type BoxProps } from '@mui/material'
import { memo, type ReactNode } from 'react'

interface Props extends BoxProps {
  children: ReactNode
}

function RequestTabPanel({ children, sx, ...rest }: Props) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderTop: 0,
        borderRadius: '0 0 6px 6px',
        bgcolor: 'background.paper',
        p: 0.75,
        pt: 1.25,
        minHeight: 140,
        ...sx
      }}
      {...rest}
    >
      {children}
    </Box>
  )
}

export default memo(RequestTabPanel)
