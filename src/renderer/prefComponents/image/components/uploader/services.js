import i18n from '@/i18n'

export const isValidService = name => {
  return name !== 'none' && services.hasOwnProperty(name)
}

const services = {
  none: {
    name: i18n.t('pref.image.uploader.none'),
    isGdprCompliant: true,
    privacyUrl: '',
    tosUrl: '',

    agreedToLegalNotices: true
  },

  picgo: {
    name: i18n.t('pref.image.uploader.picgo'),
    isGdprCompliant: false,
    privacyUrl: '',
    tosUrl: 'https://github.com/PicGo/PicGo-Core',

    agreedToLegalNotices: true
  },

  github: {
    name: i18n.t('pref.image.uploader.github'),
    isGdprCompliant: true,
    privacyUrl: 'https://github.com/site/privacy',
    tosUrl: 'https://github.com/site/terms',

    agreedToLegalNotices: false
  },

  cliScript: {
    name: i18n.t('pref.image.uploader.cliScript'),
    isGdprCompliant: true,
    privacyUrl: '',
    tosUrl: '',
    agreedToLegalNotices: true
  }
}

export default services
