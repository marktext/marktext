// TODO: Remove information from other vue source files into this file.

export const isValidService = name => {
  return name !== 'none' && services.hasOwnProperty(name)
}

const services = {
  // Dummy service used to opt-in real services.
  none: {
    name: 'None',
    isGdprCompliant: true,
    privacyUrl: '',
    tosUrl: '',

    // Set to true to always allow to change to this dummy service
    agreedToLegalNotices: true
  },

  // Real services
  picgo: {
    name: 'Picgo',
    isGdprCompliant: false,
    privacyUrl: '',
    tosUrl: 'https://github.com/PicGo/PicGo-Core',

    // Currently a non-persistent value
    agreedToLegalNotices: true
  },

  github: {
    name: 'GitHub',
    isGdprCompliant: true,
    privacyUrl: 'https://github.com/site/privacy',
    tosUrl: 'https://github.com/site/terms',

    // Currently a non-persistent value
    agreedToLegalNotices: false
  },

  cliScript: {
    name: 'Command line script',
    isGdprCompliant: true,
    privacyUrl: '',
    tosUrl: '',
    agreedToLegalNotices: true
  }
}

export default services
