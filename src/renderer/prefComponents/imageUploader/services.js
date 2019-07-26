// TODO: Remove information from other vue source files into this file.

export const isValidService = name => {
  return name !== 'none' && services.hasOwnProperty(name)
}

const services = {
  // Dummy service used to opt-in real services.
  none: {
    name: '',
    isGdprCompliant: true,
    privacyUrl: '',
    tosUrl: '',

    // Set to true to always allow to change to this dummy service
    agreedToLegalNotices: true
  },

  // Real services
  smms: {
    name: 'sm.ms',
    isGdprCompliant: false,
    privacyUrl: '',
    tosUrl: 'https://sm.ms/about/',

    // Currently a non-persistent value
    agreedToLegalNotices: false
  },
  github: {
    name: 'GitHub',
    isGdprCompliant: true,
    privacyUrl: 'https://github.com/site/privacy',
    tosUrl: 'https://github.com/site/terms',

    // Currently a non-persistent value
    agreedToLegalNotices: false
  }
}

export default services
