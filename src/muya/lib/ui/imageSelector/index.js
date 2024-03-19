import { createApi } from 'unsplash-js'
import BaseFloat from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { EVENT_KEYS, URL_REG, isWin } from '../../config'
import { getUniqueId, getImageInfo as getImageSrc } from '../../utils'
import { getImageInfo } from '../../utils/getImageInfo'
import fs from 'fs-extra'
import { ipcRenderer } from 'electron'

import './index.css'

const toJson = res => {
  if (res.type === 'success') {
    return Promise.resolve(res.response)
  } else {
    return Promise.reject(new Error(res.type))
  }
}

class ImageSelector extends BaseFloat {
  static pluginName = 'imageSelector'

  constructor (muya, options) {
    const name = 'ag-image-selector'
    const { unsplashAccessKey } = options
    options = Object.assign(options, {
      placement: 'bottom-center',
      modifiers: {
        offset: {
          offset: '0, 0'
        }
      },
      showArrow: false
    })
    super(muya, name, options)
    this.renderArray = []
    this.oldVnode = null
    this.imageInfo = null
    if (!unsplashAccessKey) {
      this.unsplash = null
    } else {
      this.unsplash = createApi({
        accessKey: unsplashAccessKey
      })
    }
    this.photoList = []
    this.loading = false
    this.tab = 'link' // select or link
    this.isFullMode = false // is show title and alt input
    this.state = {
      alt: '',
      src: '',
      title: ''
    }
    const imageSelectorContainer = this.imageSelectorContainer = document.createElement('div')
    this.container.appendChild(imageSelectorContainer)
    this.floatBox.classList.add('ag-image-selector-wrapper')
    this.listen()
  }

  listen () {
    super.listen()
    const { eventCenter } = this.muya
    eventCenter.subscribe('muya-image-selector', ({ reference, cb, imageInfo }) => {
      if (reference) {
        // Unselected image.
        const { contentState } = this.muya
        if (contentState.selectedImage) {
          contentState.selectedImage = null
        }

        Object.assign(this.state, imageInfo.token.attrs)

        // Remove file protocol to allow autocomplete.
        const imageSrc = this.state.src
        if (imageSrc && /^file:\/\//.test(imageSrc)) {
          let protocolLen = 7
          if (isWin && /^file:\/\/\//.test(imageSrc)) {
            protocolLen = 8
          }
          this.state.src = imageSrc.substring(protocolLen)
        }

        if (this.unsplash) {
          // Load latest unsplash photos.
          this.loading = true
          this.unsplash.photos.list({
            perPage: 40
          })
            .then(toJson)
            .then(json => {
              this.loading = false
              if (Array.isArray(json.results)) {
                this.photoList = json.results
                if (this.tab === 'unsplash') {
                  this.render()
                }
              }
            })
        }

        this.imageInfo = imageInfo
        this.show(reference, cb)
        this.render()

        // Auto focus and select all content of the `src.input` element.
        const input = this.imageSelectorContainer.querySelector('input.src')
        if (input) {
          input.focus()
          input.select()
        }
      } else {
        this.hide()
      }
    })
  }

  searchPhotos = (keyword) => {
    if (!this.unsplash) {
      return
    }

    this.loading = true
    this.photoList = []
    this.unsplash.search.getPhotos({
      query: keyword,
      page: 1,
      perPage: 40
    })
      .then(toJson)
      .then(json => {
        this.loading = false
        if (Array.isArray(json.results)) {
          this.photoList = json.results
          if (this.tab === 'unsplash') {
            this.render()
          }
        }
      })

    return this.render()
  }

  tabClick (event, tab) {
    const { value } = tab
    this.tab = value
    return this.render()
  }

  toggleMode () {
    this.isFullMode = !this.isFullMode
    return this.render()
  }

  inputHandler (event, type) {
    const value = event.target.value
    this.state[type] = value
  }

  handleKeyDown (event) {
    if (event.key === EVENT_KEYS.Enter) {
      event.stopPropagation()
      this.handleLinkButtonClick()
    }
  }

  srcInputKeyDown (event) {
    const { imagePathPicker } = this.muya
    if (!imagePathPicker.status) {
      if (event.key === EVENT_KEYS.Enter) {
        event.stopPropagation()
        this.handleLinkButtonClick()
      }
      return
    }
    switch (event.key) {
      case EVENT_KEYS.ArrowUp:
        event.preventDefault()
        imagePathPicker.step('previous')
        break
      case EVENT_KEYS.ArrowDown:
      case EVENT_KEYS.Tab:
        event.preventDefault()
        imagePathPicker.step('next')
        break
      case EVENT_KEYS.Enter:
        event.preventDefault()
        imagePathPicker.selectItem(imagePathPicker.activeItem)
        break
      default:
        break
    }
  }

  renameInputKeyDown (event) {
    if (event.key === EVENT_KEYS.Enter) {
      event.stopPropagation()
      this.handleRenameButtonClick()
    }
  }

  async handleKeyUp (event) {
    const { key } = event
    if (
      key === EVENT_KEYS.ArrowUp ||
      key === EVENT_KEYS.ArrowDown ||
      key === EVENT_KEYS.Tab ||
      key === EVENT_KEYS.Enter
    ) {
      return
    }
    const value = event.target.value
    const { eventCenter } = this.muya
    const reference = this.imageSelectorContainer.querySelector('input.src')
    const cb = item => {
      const { text } = item

      let basePath = ''
      const pathSep = value.match(/(\/|\\)(?:[^/\\]+)$/)
      if (pathSep && pathSep[0]) {
        basePath = value.substring(0, pathSep.index + 1)
      }

      const newValue = basePath + text
      const len = newValue.length
      reference.value = newValue
      this.state.src = newValue
      reference.focus()
      reference.setSelectionRange(
        len,
        len
      )
    }

    let list
    if (!value) {
      list = []
    } else {
      list = await this.muya.options.imagePathAutoComplete(value)
    }
    eventCenter.dispatch('muya-image-picker', { reference, list, cb })
  }

  handleLinkButtonClick () {
    return this.replaceImageAsync(this.state)
  }

  handleRenameButtonClick () {
    const oldSrc = this.imageInfo.token.attrs.src
    let { src: newLocalPath } = getImageSrc(this.state.src, this.muya.options)
    let { src: oldLocalPath } = getImageSrc(oldSrc, this.muya.options)

    newLocalPath = newLocalPath.replace('file://', '')
    oldLocalPath = oldLocalPath.replace('file://', '')

    try {
      fs.renameSync(oldLocalPath, newLocalPath)
    } catch (error) {
      this.state.src = oldSrc
      ipcRenderer.send('mt::show-user-notification-dialog', 'Could not rename file', error)
    }

    return this.replaceImageAsync(this.state)
  }

  replaceImageAsync = async ({ alt, src, title }) => {
    if (!this.muya.options.imageAction || URL_REG.test(src)) {
      const { alt: oldAlt, src: oldSrc, title: oldTitle } = this.imageInfo.token.attrs
      if (alt !== oldAlt || src !== oldSrc || title !== oldTitle) {
        this.muya.contentState.replaceImage(this.imageInfo, { alt, src, title })
      }
      this.hide()
    } else {
      if (src) {
        const id = `loading-${getUniqueId()}`
        this.muya.contentState.replaceImage(this.imageInfo, {
          alt: id,
          src,
          title
        })
        this.hide()

        try {
          const newSrc = await this.muya.options.imageAction(src, id, alt)
          const { src: localPath } = getImageSrc(src, this.muya.options)
          if (localPath) {
            this.muya.contentState.stateRender.urlMap.set(newSrc, localPath)
          }
          const imageWrapper = this.muya.container.querySelector(`span[data-id=${id}]`)

          if (imageWrapper) {
            const imageInfo = getImageInfo(imageWrapper, this.muya.options)
            this.muya.contentState.replaceImage(imageInfo, {
              alt,
              src: newSrc,
              title
            })
          }
        } catch (error) {
          ipcRenderer.send('mt::show-user-notification-dialog', 'Error while updating image', error)
        }
      } else {
        this.hide()
      }
    }
    this.muya.eventCenter.dispatch('stateChange')
  }

  async handleSelectButtonClick () {
    if (!this.muya.options.imagePathPicker) {
      console.warn('You need to add a imagePathPicker option')
      return
    }

    const path = await this.muya.options.imagePathPicker()
    const { alt, title } = this.state
    return this.replaceImageAsync({
      alt,
      title,
      src: path
    })
  }

  renderHeader () {
    const tabs = [{
      label: 'Select',
      value: 'select'
    }, {
      label: 'Embed link',
      value: 'link'
    }, {
      label: 'Rename',
      value: 'rename'
    }]

    if (this.unsplash) {
      tabs.push({
        label: 'Unsplash',
        value: 'unsplash'
      })
    }

    const children = tabs.map(tab => {
      const itemSelector = this.tab === tab.value ? 'li.active' : 'li'
      return h(itemSelector, h('span', {
        on: {
          click: event => {
            this.tabClick(event, tab)
          }
        }
      }, tab.label))
    })

    return h('ul.header', children)
  }

  renderBody = () => {
    const { tab, state, isFullMode } = this
    const { alt, title, src } = state
    let bodyContent = null
    if (tab === 'select') {
      bodyContent = [
        h('button.muya-button.role-button.select', {
          on: {
            click: event => {
              this.handleSelectButtonClick()
            }
          }
        }, 'Choose an Image'),
        h('span.description', 'Choose image from your computer.')
      ]
    } else if (tab === 'link') {
      const altInput = h('input.alt', {
        props: {
          placeholder: 'Alt text',
          value: alt
        },
        on: {
          input: event => {
            this.inputHandler(event, 'alt')
          },
          paste: event => {
            this.inputHandler(event, 'alt')
          },
          keydown: event => {
            this.handleKeyDown(event)
          }
        }
      })
      const srcInput = h('input.src', {
        props: {
          placeholder: 'Image link or local path',
          value: src
        },
        on: {
          input: event => {
            this.inputHandler(event, 'src')
          },
          paste: event => {
            this.inputHandler(event, 'src')
          },
          keydown: event => {
            this.srcInputKeyDown(event)
          },
          keyup: event => {
            this.handleKeyUp(event)
          }
        }
      })
      const titleInput = h('input.title', {
        props: {
          placeholder: 'Image title',
          value: title
        },
        on: {
          input: event => {
            this.inputHandler(event, 'title')
          },
          paste: event => {
            this.inputHandler(event, 'title')
          },
          keydown: event => {
            this.handleKeyDown(event)
          }
        }
      })

      const inputWrapper = isFullMode
        ? h('div.input-container', [altInput, srcInput, titleInput])
        : h('div.input-container', [srcInput])

      const embedButton = h('button.muya-button.role-button.link', {
        on: {
          click: event => {
            this.handleLinkButtonClick()
          }
        }
      }, 'Embed Image')
      const bottomDes = h('span.description', [
        h('span', 'Paste web image or local image path. Use '),
        h('a', {
          on: {
            click: event => {
              this.toggleMode()
            }
          }
        }, `${isFullMode ? 'simple mode' : 'full mode'}.`)
      ])
      bodyContent = [inputWrapper, embedButton, bottomDes]
    } else if (tab === 'rename') {
      const srcInput = h('input.src', {
        props: {
          placeholder: 'New image link or local path',
          value: src
        },
        on: {
          input: event => {
            this.inputHandler(event, 'src')
          },
          paste: event => {
            this.inputHandler(event, 'src')
          },
          keydown: event => {
            this.renameInputKeyDown(event)
          }
        }
      })

      const inputWrapper = h('div.input-container', [srcInput])
      const renameButton = h('button.muya-button.role-button.link', {
        on: {
          click: event => {
            this.handleRenameButtonClick()
          }
        }
      }, 'Rename Image')
      bodyContent = [inputWrapper, renameButton]
    } else {
      const searchInput = h('input.search', {
        props: {
          placeholder: 'Search photos on Unsplash'
        },
        on: {
          keydown: (event) => {
            const value = event.target.value
            if (event.key === EVENT_KEYS.Enter && value) {
              event.preventDefault()
              event.stopPropagation()
              this.searchPhotos(value)
            }
          }
        }
      })
      bodyContent = [searchInput]
      if (this.loading) {
        const loadingCom = h('div.ag-plugin-loading')
        bodyContent.push(loadingCom)
      } else if (this.photoList.length === 0) {
        const noDataCom = h('div.no-data', 'No result...')
        bodyContent.push(noDataCom)
      } else {
        const photos = this.photoList.map(photo => {
          const imageWrapper = h('div.image-wrapper', {
            props: {
              style: `background: ${photo.color};`
            },
            on: {
              click: () => {
                const title = photo.user.name
                const alt = photo.alt_description
                const src = photo.urls.regular
                const { id: photoId } = photo
                this.unsplash.photos.get({ photoId })
                  .then(toJson)
                  .then(result => {
                    this.unsplash.photos.trackDownload({
                      downloadLocation: result.links.download_location
                    })
                  })
                return this.replaceImageAsync({ alt, title, src })
              }
            }
          }, h('img', {
            props: {
              src: photo.urls.thumb
            }
          }))

          const desCom = h('div.des', ['By ', h('a', {
            props: {
              href: photo.links.html
            },
            on: {
              click: () => {
                if (this.options.photoCreatorClick) {
                  this.options.photoCreatorClick(photo.user.links.html)
                }
              }
            }
          }, photo.user.name)])
          return h('div.photo', [imageWrapper, desCom])
        })
        const photoWrapper = h('div.photos-wrapper', photos)
        const moreCom = h('div.more', 'Search for more photos...')
        bodyContent.push(photoWrapper, moreCom)
      }
    }

    return h('div.image-select-body', bodyContent)
  }

  render () {
    const { oldVnode, imageSelectorContainer } = this
    const selector = 'div'
    const vnode = h(selector, [this.renderHeader(), this.renderBody()])
    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(imageSelectorContainer, vnode)
    }
    this.oldVnode = vnode
  }
}

export default ImageSelector
