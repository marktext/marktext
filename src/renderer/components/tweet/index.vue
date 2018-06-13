<template>
  <div class="tweet-dialog" :class="theme">
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
          <textarea cols="30" rows="10" v-model="value" ref="textarea"></textarea>
        </div>
        <div class="button">
          <a
            href="javascript:;"
            class="github"
            @click="reportViaGithub"
          >
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
  import { mapState } from 'vuex'
  import bus from '../../bus'

  export default {
    data () {
      return {
        showTweetDialog: false,
        value: '',
        selectedFace: 'smile'
      }
    },
    computed: {
      ...mapState({
        'theme': state => state.preferences.theme
      })
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
        shell.openExternal('https://github.com/marktext/marktext/issues')
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
    width: 450px;
    color: var(--regularColor);
    & .title {
      font-size: 24px;
    }
  }
  .feeling, .feedback {
    font-size: 16px;
  }
  .feeling {
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
  .feedback {
    & > textarea {
      width: 100%;
      box-sizing: border-box;
      margin: 15px 0;
      padding: .5rem;
      resize: none;
      outline: none;
      border-color: var(--lightBorder);
      border-radius: 5px;
      font-size: 14px;
      height: 80px;
    }
  }
  .button {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .button a.twitter {
    color: var(--secondaryColor);
    text-decoration: none;
    width: auto;
    height: 30px;
    line-height: 30px;
    padding: 0 8px;
    border-radius: 2px;
    box-sizing: border-box;
    display: inline-block;
    background: #eee;
  }
  .button a.active, .button a.twitter:hover {
    background: #1da1f2;
    color: #fff;
  }
  .button a.github {
    color: var(--secondaryColor);
    text-decoration: none;
    &:hover {
      color: #1da1f2;
    }
  }
</style>
