<p align="center"><img src="https://github.com/marktext/marktext/blob/master/static/logo-small.png" alt="mark text" width="100" height="100"></p>

<h1 align="center">Mark Text</h1>

<div align="center">
  <a href="https://twitter.com/intent/tweet?via=marktextme&url=https://github.com/marktext/marktext/&text=What%20do%20you%20want%20to%20say%20to%20me?&hashtags=happyMarkText">
    <img src="https://img.shields.io/twitter/url/https/github.com/marktext/marktext.svg?style=for-the-badge" alt="twitter">
  </a>
</div>
<div align="center">
  <strong>:high_brightness:Yeni nesil markdown editörü:crescent_moon:</strong>
</div>
<div align="center">
  OSX, Windows ve Linux platformları için bir <code>Electron</code> uygulaması
</div>

<br />

<div align="center">
  <!-- Version -->
  <a href="https://marktext.github.io/website">
    <img src="https://badge.fury.io/gh/jocs%2Fmarktext.svg" alt="website">
  </a>
  <!-- License -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/github/license/marktext/marktext.svg" alt="LICENSE">
  </a>
  <!-- Build Status -->
  <a href="https://marktext.github.io/website">
    <img src="https://travis-ci.org/marktext/marktext.svg?branch=master" alt="build">
  </a>
  <!-- Downloads total -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/github/downloads/marktext/marktext/total.svg" alt="total download">
  </a>
  <!-- Downloads latest release -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/github/downloads/marktext/marktext/v0.13.65/total.svg" alt="latest download">
  </a>
  <!-- deps -->
  <a href="https://marktext.github.io/website">
    <img src="https://img.shields.io/hackage-deps/v/lens.svg" alt="dependencies">
  </a>
  <!-- sponsors -->
  <a href="https://opencollective.com/marktext">
    <img src="https://opencollective.com/marktext/tiers/silver-sponsors/badge.svg?label=SilverSponsors&color=brightgreen" alt="sponsors">
  </a>
</div>

<div align="center">
  <h3>
    <a href="https://marktext.github.io/website">
      Web sitesi
    </a>
     <span> | </span>
    <a href="https://github.com/marktext/marktext/blob/master/doc/i18n/tr.md#readme">
      Türkçe
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#features">
      Özellikler
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#download-and-install">
      İndirmeler
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#development">
      Geliştirme
    </a>
    <span> | </span>
    <a href="https://github.com/marktext/marktext#contribution">
      Katkı
    </a>
  </h3>
</div>

<div align="center">
  <sub>Bu Markdown editör ❤︎
    <a href="https://github.com/Jocs">Jocs</a> ve
    <a href="https://github.com/marktext/marktext/graphs/contributors">
      katkıda bulunanlar tarafından yapıldı.
    </a>
  </sub>
</div>

<br />

![](https://github.com/marktext/marktext/blob/master/doc/marktext.gif)

## Özellikler

- Gerçek zamanlı önizleme ve render motoru olarak [snabbdom](https://github.com/snabbdom/snabbdom) kullanıldı.
- [CommonMark Spec](https://spec.commonmark.org/0.28/) ve [GitHub Flavored Markdown Spec](https://github.github.com/gfm/) destekliyor.
- Yazım verimliliğinizi artırmak için paragraf ve satır içi stil kısayollarını destekliyor.
- **HTML** ve **PDF** dosya çıktısı alınabiliyor.
- Dark ve Light olarak iki tema seçeneği bulunuyor.
- Çeşitli düzenleme modları: **Source Code mode**, **Typewriter mode**, **Focus mode**.

<h4 align="center">:crescent_moon:Dark ve Light temaları:high_brightness:</h4>

|                        Dark :crescent_moon:                        |                       Light :high_brightness:                       |
| :----------------------------------------------------------------: | :-----------------------------------------------------------------: |
| ![](https://github.com/marktext/marktext/blob/master/doc/dark.jpg) | ![](https://github.com/marktext/marktext/blob/master/doc/light.jpg) |

<h4 align="center">:smile_cat:Düzenleme modları:dog:</h4>

|                              Kaynak Kod                              |                                 Daktilo                                  |                              Odaklama                               |
| :------------------------------------------------------------------: | :----------------------------------------------------------------------: | :-----------------------------------------------------------------: |
| ![](https://github.com/marktext/marktext/blob/master/doc/source.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/typewriter.gif) | ![](https://github.com/marktext/marktext/blob/master/doc/focus.gif) |

## Neden başka editör yazıyoruz?

1.  Yazmayı seviyorum.Birçok markdown editörü kullandım, ama benim gereksinimlerimi tam anlamı ile karşılayanı bulamadım.Yazarken bazı dayanılmaz buglar ile rahatsız edilmekten hoşlanmıyorum. **Mark Text** sayfayı yorumlamak için virtual DOM kullanıyor, yüksek verimlilik sağlıyor,bundan dolayı yazmayı ve markdown seven bütün arkadaşlara açık kaynak.
2.  Yukarıda bahsettiğim gibi **Mark Text** sonsuza dek açık kaynak olacak.Tüm markdown sevenlerin kendi kodlarına katkıda bulunması ve **Mark Text**'in daha popüler bir markdown editör olmasını ümit ediyorum.
3.  Birçok markdown editör var ve her biri kendine göre karakteristiğe sahip, ama tüm markdown kullanıcılarını tatmin etmesi zor.**Mark Text** 'in markdown editör kullanıcılarının gereksinimlerini mümkün oldukça tatmin edeceğini umuyorum. **Mark Text** editörü hala mükemmel olmamasına rağmen, onu elimizden geldikçe mükemmel hale getirmeye çalışıyoruz.

## İndirme ve Yükleme

![Conda](https://img.shields.io/conda/pn/conda-forge/python.svg?style=for-the-badge)

|                                                         ![](https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/mac-pass-sm.png)                                                         |                                                             ![](https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/windows-pass-sm.png)                                                             |                                                                    ![](https://github.com/ryanoasis/nerd-fonts/wiki/screenshots/v1.0.x/linux-pass-sm.png)                                                                    |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.13.65.dmg.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-0.13.65.dmg) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-setup-0.13.65.exe.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-setup-0.13.65.exe) | [![latest version](https://img.shields.io/github/downloads/marktext/marktext/latest/marktext-0.13.65-x86_64.AppImage.svg)](https://github.com/marktext/marktext/releases/download/v0.13.65/marktext-0.13.65-x86_64.AppImage) |

Kendi sistemini bulamıyor musun? [Yayınlanma sayfasına](https://github.com/marktext/marktext/releases) git.Hala mı bulamıyorsun? Bir [issue](https://github.com/marktext/marktext/issues) aç.

Bu versiyonda yeni özellikler mi görmek istiyorsun? [CHANGELOG](https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md) başvur.

Eğer OSX sistemi kullanıyorsan, [**homebrew cask**](https://github.com/caskroom/homebrew-cask) kullanarak Mark Text yükleyebilirsin, Homebrew-Cask kullanmaya başlamak için sadece [Homebrew](https://brew.sh/) yüklemen gerekli.

```bash
brew cask install mark-text
```

![](https://github.com/marktext/marktext/blob/master/doc/brew-cask.gif)

#### macOS ve Windows

Basitçe indirin ve Mark Text kurulum sihirbazı ile kurulumu tamamlayın.

#### Linux

Lütfen [Linux kurulum talimatını](https://github.com/marktext/marktext/blob/master/doc/LINUX.md) takip ediniz.

## Geliştirme

Eğer **Mark Text** kendiniz geliştirmek isterseniz, lütfen bizim [geliştirici dökümantasyonunu](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md#build-instructions) kontrol edin.

**Mark Text** kullanırken bir sorun olursa, bir issue açabilirsin, ama issue formatına uyacağına umuyoruz.Tabi ki direk olarak PR gönderbilirsin bundan memnuniyet duyarız.

## Entegrasyon

- [Alfred Workflow](http://www.packal.org/workflow/mark-text): Alfred OSX için bir iş akışı uygulaması: Mark Text ile dosya/klasör açmak için "mt" kullanıyor.

## Katkıda Bulunmak

Mark Text geliştirme aşamasında, lütfen pull request yapmadan önce [Katkıda bulunma Rehberini](https://github.com/marktext/marktext/blob/master/.github/CONTRIBUTING.md) okuduğunuza emin olun.Mark Text'e yeni özellikler eklemek mi istiyorsun? [TODO LIST](https://github.com/marktext/marktext/blob/master/.github/TODOLIST.md)'e başvur ve bir issue aç.

## Destekçiler

Tüm destekçilerimize teşekkürler! 🙏 [[Destekçi ol](https://opencollective.com/marktext#backers)]

<a href="https://opencollective.com/marktext#backers" target="_blank"><img src="https://opencollective.com/marktext/tiers/backer.svg?avatarHeight=36" /></a>

## Sponsorlar

Sponsor olarak bu projeye desktek verin. Logonuz burada websitenizin linki verilerek gösterilecek. [[Sponsor Ol](https://opencollective.com/marktext#silver-sponsors)]

**Platinum Sponsorlar**

<a href="https://readme.io" target="_blank"><img src="https://github.com/marktext/marktext/blob/master/doc/sponsor/readme.png" /></a>

## Katkıda bulunanlar

Mark Text'e katkıda bulunmuş herkese teşekkürler.[[contributors](https://github.com/marktext/marktext/graphs/contributors)]

Özellikle Mark Text logosunu tasarlayan @[Yasujizr](https://github.com/Yasujizr)'a teşekkürler.

<a href="https://github.com/marktext/marktext/graphs/contributors"><img src="https://opencollective.com/marktext/contributors.svg?width=890" /></a>

## Lisans

[**MIT**](https://github.com/marktext/marktext/blob/master/LICENSE).

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmarktext%2Fmarktext?ref=badge_large)
