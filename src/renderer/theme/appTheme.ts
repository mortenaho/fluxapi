import { createTheme, type ThemeOptions } from '@mui/material/styles'
import { APP_TOOLTIP_Z_INDEX } from './zIndex'

const primaryLight = {
  main: '#560072',
  light: '#8a3d9e',
  dark: '#3a004d',
  contrastText: '#ffffff'
}

/** Brighter primary for dark mode — dark purple is invisible on dark surfaces. */
const primaryDark = {
  main: '#c084fc',
  light: '#e9d5ff',
  dark: '#9333ea',
  contrastText: '#1e1030'
}

const sharedComponents: ThemeOptions['components'] = {
  MuiButton: {
    styleOverrides: {
      root: { textTransform: 'none' },
      contained: {
        fontWeight: 600,
        '& .MuiButton-startIcon, & .MuiButton-endIcon, & .MuiSvgIcon-root': {
          color: 'inherit'
        }
      },
      containedPrimary: ({ theme }) => ({
        color: theme.palette.primary.contrastText,
        backgroundColor: theme.palette.primary.main,
        '&:hover': {
          backgroundColor: theme.palette.primary.dark
        }
      }),
      outlined: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              borderColor: theme.palette.primary.main,
              color: theme.palette.primary.main,
              '&:hover': {
                borderColor: theme.palette.primary.light,
                color: theme.palette.primary.light,
                backgroundColor: 'rgba(192, 132, 252, 0.12)'
              },
              '& .MuiButton-startIcon, & .MuiButton-endIcon, & .MuiSvgIcon-root': {
                color: 'inherit'
              }
            }
          : {}
    }
  },
  MuiTab: {
    styleOverrides: {
      root: ({ theme }) => ({
        textTransform: 'none',
        minHeight: 36,
        fontWeight: 500,
        color: theme.palette.text.secondary,
        opacity: 1,
        '&.Mui-selected': {
          color: theme.palette.text.primary,
          fontWeight: 600
        }
      })
    }
  },
  MuiTabs: {
    styleOverrides: {
      indicator: ({ theme }) => ({
        height: 2,
        backgroundColor: theme.palette.primary.main
      })
    }
  },
  MuiAppBar: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: {
        backgroundColor: primaryLight.main,
        color: primaryLight.contrastText,
        borderBottom: 'none',
        backgroundImage: 'none'
      }
    }
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              backgroundColor: '#0c0c0e',
              borderRight: `1px solid ${theme.palette.divider}`
            }
          : {
              borderRight: `1px solid ${theme.palette.divider}`
            }
    }
  },
  MuiPaper: {
    styleOverrides: {
      root: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              backgroundImage: 'none'
            }
          : {},
      outlined: ({ theme }) => ({
        borderColor: theme.palette.divider
      })
    }
  },
  MuiMenu: {
    styleOverrides: {
      paper: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              backgroundImage: 'none',
              backgroundColor: '#1e2330',
              border: `1px solid ${theme.palette.divider}`
            }
          : {}
    }
  },
  MuiPopover: {
    styleOverrides: {
      paper: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              backgroundImage: 'none',
              backgroundColor: '#1e2330',
              border: `1px solid ${theme.palette.divider}`
            }
          : {}
    }
  },
  MuiMenuItem: {
    styleOverrides: {
      root: ({ theme }) => ({
        '&.Mui-selected': {
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(192, 132, 252, 0.18)' : undefined,
          '&:hover': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(192, 132, 252, 0.26)' : undefined
          }
        },
        '&:hover': {
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.1)' : undefined
        }
      })
    }
  },
  MuiInputBase: {
    styleOverrides: {
      root: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              color: theme.palette.text.primary
            }
          : {}
    }
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(148, 163, 184, 0.22)'
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(148, 163, 184, 0.38)'
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.primary.main
              }
            }
          : {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.divider
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.text.secondary
              }
            },
      input: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              '&::placeholder': {
                color: 'rgba(148, 163, 184, 0.55)',
                opacity: 1
              }
            }
          : {}
    }
  },
  MuiInputLabel: {
    styleOverrides: {
      root: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              color: theme.palette.text.secondary,
              '&.Mui-focused': {
                color: theme.palette.primary.main
              }
            }
          : {}
    }
  },
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              backgroundImage: 'none',
              backgroundColor: '#1a1d26',
              border: `1px solid ${theme.palette.divider}`
            }
          : {}
    }
  },
  MuiListItemButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: 0,
        '&.Mui-selected': {
          backgroundColor:
            theme.palette.mode === 'dark' ? 'rgba(192, 132, 252, 0.2)' : 'rgba(86, 0, 114, 0.12)',
          color: theme.palette.mode === 'dark' ? '#f8fafc' : theme.palette.text.primary,
          '& .MuiListItemIcon-root': {
            color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main
          },
          '&:hover': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(192, 132, 252, 0.28)' : 'rgba(86, 0, 114, 0.16)'
          }
        }
      })
    }
  },
  MuiChip: {
    styleOverrides: {
      outlined: ({ theme }) => ({
        borderColor: theme.palette.divider
      }),
      colorPrimary: ({ theme }) => ({
        color: theme.palette.primary.contrastText,
        backgroundColor: theme.palette.primary.main,
        '& .MuiChip-icon': { color: 'inherit' },
        '& .MuiChip-label': { color: 'inherit' }
      }),
      filled: ({ theme, ownerState }) => {
        if (ownerState.color === 'primary' || ownerState.color === 'secondary') {
          return {
            color: theme.palette.primary.contrastText,
            '& .MuiChip-icon, & .MuiChip-label': { color: 'inherit' }
          }
        }
        if (theme.palette.mode === 'dark' && (ownerState.color === 'default' || !ownerState.color)) {
          return {
            backgroundColor: 'rgba(148, 163, 184, 0.18)',
            color: theme.palette.text.primary
          }
        }
        return {}
      }
    }
  },
  MuiToggleButtonGroup: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderColor: theme.palette.divider,
        '& .MuiToggleButton-root': {
          borderColor: theme.palette.divider,
          color: theme.palette.text.secondary,
          '&.Mui-selected': {
            color: theme.palette.text.primary,
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(192, 132, 252, 0.16)' : 'rgba(0, 0, 0, 0.06)'
          },
          '&:hover': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.1)' : undefined
          }
        }
      })
    }
  },
  MuiAccordion: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.background.paper,
        backgroundImage: 'none',
        borderColor: theme.palette.divider
      })
    }
  },
  MuiCheckbox: {
    styleOverrides: {
      root: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              color: 'rgba(148, 163, 184, 0.5)',
              '&.Mui-checked': {
                color: theme.palette.primary.main
              }
            }
          : {}
    }
  },
  MuiSwitch: {
    styleOverrides: {
      switchBase: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              '&.Mui-checked': {
                color: theme.palette.primary.main,
                '& + .MuiSwitch-track': {
                  backgroundColor: theme.palette.primary.dark,
                  opacity: 0.9
                }
              }
            }
          : {}
    }
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              color: theme.palette.text.secondary,
              '&:hover': {
                color: theme.palette.text.primary,
                backgroundColor: 'rgba(148, 163, 184, 0.1)'
              }
            }
          : {}
    }
  },
  MuiAlert: {
    styleOverrides: {
      root: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              backgroundImage: 'none'
            }
          : {}
    }
  },
  MuiDivider: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderColor: theme.palette.divider
      })
    }
  },
  MuiAutocomplete: {
    styleOverrides: {
      paper: ({ theme }) =>
        theme.palette.mode === 'dark'
          ? {
              backgroundImage: 'none',
              backgroundColor: '#1e2330',
              border: `1px solid ${theme.palette.divider}`
            }
          : {}
    }
  },
  MuiTooltip: {
    defaultProps: {
      followCursor: true,
      enterDelay: 300,
      enterNextDelay: 100,
      slotProps: {
        popper: {
          sx: { zIndex: APP_TOOLTIP_Z_INDEX }
        }
      }
    },
    styleOverrides: {
      popper: {
        zIndex: APP_TOOLTIP_Z_INDEX
      },
      tooltip: {
        pointerEvents: 'none'
      }
    }
  }
}

export function createAppTheme(mode: 'light' | 'dark') {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: isDark ? primaryDark : primaryLight,
      secondary: {
        main: isDark ? '#38bdf8' : '#0265dc'
      },
      ...(isDark
        ? {
            background: {
              default: '#09090b',
              paper: '#111113'
            },
            divider: 'rgba(148, 163, 184, 0.12)',
            text: {
              primary: '#f1f5f9',
              secondary: '#94a3b8',
              disabled: 'rgba(148, 163, 184, 0.45)'
            },
            action: {
              active: '#e2e8f0',
              hover: 'rgba(148, 163, 184, 0.1)',
              selected: 'rgba(192, 132, 252, 0.16)',
              disabled: 'rgba(148, 163, 184, 0.38)',
              disabledBackground: 'rgba(148, 163, 184, 0.08)'
            }
          }
        : {
            background: {
              default: '#f5f5f5',
              paper: '#ffffff'
            }
          })
    },
    typography: {
      fontFamily: 'Roboto, sans-serif'
    },
    shape: {
      borderRadius: 8
    },
    zIndex: {
      tooltip: APP_TOOLTIP_Z_INDEX
    },
    components: {
      ...sharedComponents,
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: mode },
          body: {
            scrollbarColor: isDark ? '#475569 transparent' : undefined
          },
          '*::-webkit-scrollbar': {
            width: 8,
            height: 8
          },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(0, 0, 0, 0.2)',
            borderRadius: 4
          },
          '*::-webkit-scrollbar-track': {
            backgroundColor: 'transparent'
          }
        }
      }
    }
  })
}

export const DARK_EDITOR_BG = '#1a1d26'
