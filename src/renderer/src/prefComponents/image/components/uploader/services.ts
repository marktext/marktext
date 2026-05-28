// TODO: Remove information from other vue source files into this file.
import { t } from '../../../../i18n'

export interface UploaderService {
  name: string
  isGdprCompliant: boolean
  privacyUrl: string
  tosUrl: string
  agreedToLegalNotices: boolean
}

export type UploaderServiceId = 'picgo' | 'cliScript'

export const isValidService = (name: string): boolean => {
  return Object.prototype.hasOwnProperty.call(getServices(), name)
}

const getServices = (): Record<UploaderServiceId, UploaderService> => ({
  picgo: {
    name: t('preferences.image.uploader.services.picgo'),
    isGdprCompliant: false,
    privacyUrl: '',
    tosUrl: 'https://github.com/PicGo/PicGo-Core',
    agreedToLegalNotices: true
  },

  cliScript: {
    name: t('preferences.image.uploader.services.cliScript'),
    isGdprCompliant: true,
    privacyUrl: '',
    tosUrl: '',
    agreedToLegalNotices: true
  }
})

export { getServices }
export default getServices
