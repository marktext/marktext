module.exports = {
  productName: 'Mark Text',
  appId: 'com.github.marktext.marktext',
  asar: true,
  asarUnpack: [
    '**/*.node'
  ],
  directories: {
    'output': 'build'
  },
  fileAssociations: [
    {
      ext: [
        'md',
        'markdown',
        'mmd',
        'mdown',
        'mdtxt',
        'mdtext'
      ],
      name: 'Markdown',
      description: 'Markdown document',
      role: 'Editor',
      icon: '../resources/icons/md.icns'
    }
  ],
  files: [
    'dist/electron/**/*'
  ],
  extraFiles: [
    'LICENSE',
    {
      from: 'resources/THIRD-PARTY-LICENSES.txt',
      to: 'THIRD-PARTY-LICENSES.txt'
    }
  ],
  dmg: {
    artifactName: 'marktext-${version}.${ext}',
    contents: [
      {
        x: 410,
        y: 150,
        type: 'link',
        path: '/Applications'
      },
      {
        x: 130,
        y: 150,
        type: 'file'
      }
    ]
  },
  mac: {
    artifactName: 'marktext-${version}-mac.${ext}',
    icon: 'resources/icons/icon.icns',
    darkModeSupport: true
  },
  win: {
    artifactName: 'marktext-${version}-${arch}-win.${ext}',
    icon: 'resources/icons/icon.ico',
    target: [
      {
        target: 'nsis',
        arch: [
          'ia32',
          'x64'
        ]
      },
      {
        target: 'zip',
        arch: [
          'ia32',
          'x64'
        ]
      }
    ],
    requestedExecutionLevel: 'asInvoker'
  },
  nsis: {
    artifactName: 'marktext-setup-${version}.${ext}',
    perMachine: false,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    include: 'resources/windows/installer.nsh'
  },
  linux: {
    artifactName: 'marktext-${version}-${arch}.${ext}',
    category: 'Office;TextEditor;Utility',
    mimeTypes: [
      'text/markdown'
    ],
    icon: 'resources/icons',
    desktop: {
      StartupWMClass: 'marktext',
      Keywords: 'marktext;'
    },
    target: [
      {
        target: 'AppImage'
      },
      {
        target: 'tar.gz'
      }
    ],
    fileAssociations: [
      {
        ext: 'md',
        name: 'Markdown',
        description: 'Markdown document'
      },
      {
        ext: 'markdown',
        name: 'Markdown',
        description: 'Markdown document'
      },
      {
        ext: 'mmd',
        name: 'Markdown',
        description: 'Markdown document'
      },
      {
        ext: 'mdown',
        name: 'Markdown',
        description: 'Markdown document'
      },
      {
        ext: 'mdtxt',
        name: 'Markdown',
        description: 'Markdown document'
      },
      {
        ext: 'mdtext',
        name: 'Markdown',
        description: 'Markdown document'
      }
    ]
  }
}
