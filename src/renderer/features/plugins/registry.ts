import type { ComponentType } from 'react'
import LinkIcon from '@mui/icons-material/Link'
import LockIcon from '@mui/icons-material/Lock'
import TagIcon from '@mui/icons-material/Tag'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import Base64Plugin from './Base64Plugin'
import CryptoPlugin from './CryptoPlugin'
import HashPlugin from './HashPlugin'
import JwtPlugin from './JwtPlugin'
import UrlEncodePlugin from './UrlEncodePlugin'

export interface PluginDefinition {
  id: string
  name: string
  description: string
  icon: ComponentType<{ sx?: object }>
  component: ComponentType
}

export const PLUGINS: PluginDefinition[] = [
  {
    id: 'base64',
    name: 'Base64',
    description: 'Encode and decode text with Base64',
    icon: TextFieldsIcon,
    component: Base64Plugin
  },
  {
    id: 'url',
    name: 'URL Encode',
    description: 'Encode and decode URL strings',
    icon: LinkIcon,
    component: UrlEncodePlugin
  },
  {
    id: 'hash',
    name: 'Hash',
    description: 'SHA-256 / SHA-384 / SHA-512',
    icon: TagIcon,
    component: HashPlugin
  },
  {
    id: 'jwt',
    name: 'JWT Decode',
    description: 'Decode JWT header and payload',
    icon: VpnKeyIcon,
    component: JwtPlugin
  },
  {
    id: 'crypto',
    name: 'Crypto',
    description: 'Encrypt and decrypt with AES algorithms',
    icon: LockIcon,
    component: CryptoPlugin
  }
]
