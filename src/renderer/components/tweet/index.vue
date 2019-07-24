<template>
  <div class="tweet-dialog">
    <el-dialog
      :visible.sync="showTweetDialog"
      :show-close="false"
      :modal="true"
      custom-class="ag-dialog-table"
      width="450px"
    >
      <div slot="title" class="title">
        <span>Send us feedback via tweet</span>
      </div>
      <div class="body">
        <div class="feeling">
          <div>What's your experience feelings?</div>
          <ul>
            <li
              :class="{ 'active': selectedFace === 'smile' }"
              @click="faceClick('smile')"
            >
              <svg class="icon" aria-hidden="true">
                <use xlink:href="#icon-smile"></use>
              </svg>
            </li>
            <li
              :class="{ 'active': selectedFace === 'sad' }"
              @click="faceClick('sad')"
            >
              <svg class="icon" aria-hidden="true">
                <use xlink:href="#icon-sad"></use>
              </svg>
            </li>
          </ul>
        </div>
        <div class="feedback">
          <div>Tell us your feedback?</div>
          <textarea
            cols="30" rows="10" v-model="value" ref="textarea"
          ></textarea>
        </div>
        <div class="buttons">
          <a
            href="javascript:;"
            class="github"
            @click="reportViaGithub"
          >
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-github"></use>
            </svg>
            Report bug or feature request via github
          </a>
          <a
            href="javascript:;"
            class="twitter"
            :class="{ 'active': value }"
            @click="reportViaTwitter"
          >
            <svg class="icon" aria-hidden="true">
              <use xlink:href="#icon-twitter"></use>
            </svg>
            Tweet
          </a>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { shell } from 'electron'
import bus from '../../bus'

export default {
  data () {
    return {
      showTweetDialog: false,
      value: '',
      selectedFace: 'smile'
    }
  },
  created () {
    bus.$on('tweetDialog', this.showDialog)
  },
  beforeDestroy () {
    bus.$off('tweetDialog', this.showDialog)
  },
  methods: {
    showDialog () {
      this.showTweetDialog = true
      this.value = ''
      bus.$emit('editor-blur')
      this.$nextTick(() => {
        this.$refs.textarea.focus()
      })
    },
    faceClick (name) {
      this.selectedFace = name
    },
    reportViaGithub () {
      shell.openExternal('https://github.com/marktext/marktext/issues/new')
    },
    reportViaTwitter () {
      const { value, selectedFace } = this
      if (!value) return
      const origin = 'https://twitter.com/intent/tweet'

      const params = {
        via: 'marktextme',
        url: encodeURI('https://github.com/marktext/marktext/'),
        text: value
      }

      if (selectedFace === 'smile') params.hashtags = 'happyMarkText'

      shell.openExternal(`${origin}?${Object.keys(params).map(key => `${key}=${params[key]}`).join('&')}`)
      this.showTweetDialog = false
    }
  }
}
</script>

<style>
  .tweet-dialog {
    color: var(--sideBarColor);
    & .title {
      font-size: 24px;
    }
    & .el-dialog__header {
      border-top-left-radius: 5px;
      border-top-right-radius: 5px;
    }
    & .el-dialog__body {
      color: var(--sideBarColor);
    }
  }
  .tweet-dialog .feeling, .tweet-dialog .feedback {
    font-size: 16px;
  }
  .tweet-dialog .feeling {
    & ul {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      height: 45px;
      & li {
        display: flex;
        align-items: center;
        margin-right: 15px;
        cursor: pointer;
      }
    }
    & li > svg {
      transition: color .25s ease-in-out;
      width: 25px;
      height: 25px;
    }
    & li:hover > svg, & li.active > svg {
      color: rgb(255, 204, 0);
    }
  }
  .tweet-dialog .feedback {
    & > textarea {
      width: 100%;
      box-sizing: border-box;
      margin: 15px 0;
      padding: .5rem;
      resize: none;
      outline: none;
      border: 1px solid var(--floatBorderColor);
      background: var(--floatBorderColor);
      color: var(--editorColor);
      border-radius: 5px;
      font-size: 14px;
      height: 80px;
    }
  }
  .tweet-dialog .buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tweet-dialog .buttons a.twitter {
    color: var(--themeColor);
    text-decoration: none;
    width: auto;
    height: 30px;
    line-height: 30px;
    padding: 0 8px;
    border-radius: 2px;
    box-sizing: border-box;
    display: inline-block;
    background: #eee;
    cursor: not-allowed;
  }
  .tweet-dialog .buttons a.active {
    background: var(--themeColor);
    color: #fff;
  }
  .tweet-dialog .buttons a.active {
    cursor: pointer;
  }
  .tweet-dialog .buttons a.github {
    color: var(--iconColor);
    text-decoration: none;
    &:hover {
      color: var(--themeColor);
    }
    & > svg {
      width: 1.4rem;
      height: 1.4rem;
      vertical-align: bottom;
    }
  }
  .tweet-dialog .el-dialog__header {
    background: var(--themeColor);
    color: #fff;
  }
</style>
