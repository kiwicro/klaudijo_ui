import Store from 'electron-store'
import { StoreData } from '../shared/types'

const defaults: StoreData = {
  projects: [],
  pinnedFiles: {},
  panelWidths: { left: 240, right: 280 },
  windowBounds: { x: -1, y: -1, width: 1400, height: 900, maximized: false }
}

export const store = new Store<StoreData>({ defaults })
