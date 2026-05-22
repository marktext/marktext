// TODO: Remove information from other vue source files into this file.
import { t } from '../../../../i18n'

export interface UploaderService {
  name: string
  isGdprCompliant: boolean
  privacyUrl: string
  tosUrl: string
  agreedToLegalNotices: boolean
}

export type UploaderServiceId = 'none' | 'picgo' | 'github' | 'cliScript'

export const isValidService = (name: string): boolean => {
  return name !== 'none' && Object.prototype.hasOwnProperty.call(getServices(), name)
}

const getServices = (): Record<UploaderServiceId, UploaderService> => ({
  // Dummy service used to opt-in real services.
  none: {
    name: t('preferences.image.uploader.services.none'),
    isGdprCompliant: true,
    privacyUrl: '',
    tosUrl: '',

    // Set to true to always allow to change to this dummy service
    agreedToLegalNotices: true
  },

  // Real services
  picgo: {
    name: t('preferences.image.uploader.services.picgo'),
    isGdprCompliant: false,
    privacyUrl: '',
    tosUrl: 'https://github.com/PicGo/PicGo-Core',

    // Currently a non-persistent value
    agreedToLegalNotices: true
  },

  github: {
    name: t('preferences.image.uploader.services.github'),
    isGdprCompliant: true,
    privacyUrl: 'https://github.com/site/privacy',
    tosUrl: 'https://github.com/site/terms',

    // Currently a non-persistent value
    agreedToLegalNotices: false
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
