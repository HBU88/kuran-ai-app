#!/usr/bin/env node
/**
 * build-havuz.js
 * Emotion-based ayet havuzunu oluşturur.
 * Kaynak: mevcut ayahs.json (97 doğrulanmış ayet) + ek meşhur ayetler.
 * scholar_approved: false — içerik dini alim incelemesinden geçmeli.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const AYAHS_JSON   = path.join(__dirname, "../../assets/data/ayahs.json");
const OUTPUT_PATH  = path.join(__dirname, "../data/ayet-rehberi/havuz.json");

// ── Mevcut ayahs.json'dan okunan doğrulanmış ayetler ─────────────────────────
const existingAyahs = JSON.parse(fs.readFileSync(AYAHS_JSON, "utf8"));

// ── Ek meşhur ayetler (Diyanet meali referans alınmıştır) ────────────────────
// scholar_approved: false — dini alim incelemesi gereklidir.
const ADDITIONAL_AYAHS = [
  // ── SABIR / PATIENCE ──────────────────────────────────────────────────────
  { sure: 2, ayet: 155, meal: "Andolsun sizi biraz korku, açlık ve bir miktar mallardan, canlardan ve ürünlerden eksiltme ile imtihan edeceğiz. Sabredenleri müjdele.", tefsir: "Dünya hayatının bir imtihan olduğunu hatırlatan ayet. Her zorluk Allah'ın kulunu denemesidir, sabredenler ise ilahi müjdeye hak kazanır.", psy: "strength", cat: ["patience", "sadness"] },
  { sure: 2, ayet: 156, meal: "Onlar, başlarına bir musibet geldiğinde 'Biz şüphesiz Allah'a aidiz ve O'na döneceğiz' derler.", tefsir: "İnnâ lillâh duası; musibet anında teslimiyet ve Allah'a yöneliş. Acıyı hakikate bağlayan güçlü bir bilinç hali.", psy: "comfort", cat: ["patience", "sadness", "loneliness"] },
  { sure: 2, ayet: 157, meal: "İşte bunlara Rableri katından salât ve rahmet vardır; doğru yolu bulanlar da bunlardır.", tefsir: "Musibete sabredenler Allah'ın sevgisini, rahmetini ve hidayetini kazanır. Sabır bir kayıp değil, kazanımdır.", psy: "hope", cat: ["patience", "hope"] },
  { sure: 3, ayet: 200, meal: "Ey iman edenler! Sabredin, düşmana karşı sabır yarışına girin, hazırlıklı olun ve Allah'tan korkun ki kurtuluşa eresiniz.", tefsir: "Sabır bireysel bir erdem olduğu kadar toplumsal bir direnç ve hazırlık gerektiren değerdir. Kolektif sabır bireysel sabrı pekiştirir.", psy: "strength", cat: ["patience"] },
  { sure: 11, ayet: 115, meal: "Sabredin; çünkü Allah iyilik yapanların mükâfatını asla boşa çıkarmaz.", tefsir: "İyilikle birleşen sabır asla karşılıksız kalmaz. Allah her güzel amelin hesabını tutar.", psy: "hope", cat: ["patience", "hope"] },
  { sure: 16, ayet: 127, meal: "Sabret; senin sabrın ancak Allah'ın yardımıyla gerçekleşebilir. Onlar için üzülme; kurmakta oldukları tuzaktan sıkıntı duyma.", tefsir: "Sabrın kaynağı kişinin kendi gücü değil Allah'ın yardımıdır. Haksızlık yapanlara karşı sabır, onların tuzaklarından büyük bir korunmadır.", psy: "strength", cat: ["patience", "anger"] },
  { sure: 39, ayet: 10, meal: "Sabredenlere ecirleri hesapsız ödenecektir.", tefsir: "Allah sabredenler için ölçüsüz bir mükâfat vaad etmiştir. Bu, sabrın değerini anlatmak için kullanılan en güçlü Kur'an ifadelerinden biridir.", psy: "hope", cat: ["patience", "hope"] },
  { sure: 42, ayet: 43, meal: "Kim sabreder ve bağışlarsa, işte bu kararlılık gerektiren işlerdendir.", tefsir: "Sabır ve affetme; olgunluğun ve maneviyatın zirvesidir. Bunları bir arada yapmak kolaya kaçmayan, derin bir kararlılık ister.", psy: "strength", cat: ["patience", "forgiveness"] },
  { sure: 46, ayet: 35, meal: "Azim sahibi peygamberlerin sabrettiği gibi sabret.", tefsir: "Büyük peygamberlerin sabrı insanlık için bir rehber ve model. Onların yolundan giderek en ağır zorluklar da aşılabilir.", psy: "strength", cat: ["patience", "guidance"] },
  { sure: 103, ayet: 3, meal: "Ancak iman edip salih amel işleyenler ve birbirlerine hakkı, birbirlerine sabrı tavsiye edenler bunun dışındadır.", tefsir: "Asr suresinin son ayeti; kurtuluşun dört şartından biri sabrı tavsiyedir. Sabır hem bireysel bir erdem hem de toplumsal bir sorumluluktur.", psy: "strength", cat: ["patience", "guidance"] },

  // ── UMUT / HOPE ───────────────────────────────────────────────────────────
  { sure: 12, ayet: 87, meal: "Ey oğullarım! Gidin, Yusuf'u ve kardeşini araştırın. Allah'ın rahmetinden ümit kesmeyin; şüphesiz Allah'ın rahmetinden yalnız kâfirler ümit keser.", tefsir: "Hz. Yakub, oğullarından yıllar ayrı kaldıktan sonra bile ümidini yitirmemiştir. Umutsuzluk iman zaafının işaretidir; mümin her koşulda Allah'ın rahmetine güvenir.", psy: "hope", cat: ["hope", "loneliness"] },
  { sure: 3, ayet: 139, meal: "Gevşemeyin ve üzülmeyin; eğer (gerçekten) iman etmişseniz en üstün olan sizsiniz.", tefsir: "Uhud savaşında inen bu ayet, yenilgi anında müminin moralini ve kimliğini güçlendirir. İman, zorluğa rağmen ayakta durmanın temelidir.", psy: "strength", cat: ["hope", "sadness"] },
  { sure: 93, ayet: 3, meal: "Rabbin seni ne bıraktı, ne de sana darıldı.", tefsir: "Hz. Peygamber'e vahiy gecikmesinde inen bu ayet; Allah'ın desteğinin kesmediğini, bunun yalnızca bir sınav olduğunu hatırlatır. Her duraksama bir terk değildir.", psy: "comfort", cat: ["hope", "loneliness", "sadness"] },
  { sure: 93, ayet: 5, meal: "Rabbin sana verecek, sen de razı olacaksın.", tefsir: "İlahi vaad: Allah kulunun geçici sıkıntısını kalıcı nimetlerle telafi edecektir. Sabredenin sonu hayırdır.", psy: "hope", cat: ["hope", "patience"] },
  { sure: 94, ayet: 5, meal: "Şüphesiz güçlükle beraber kolaylık vardır.", tefsir: "Kur'an'ın en teselli edici ayetlerinden. Her zorlukla birlikte kolaylık da gelir; bu ilahi bir yasa, bir vaadidir.", psy: "hope", cat: ["hope", "sadness", "anxiety"] },
  { sure: 94, ayet: 6, meal: "Şüphesiz güçlükle beraber kolaylık vardır.", tefsir: "Bu ayet iki kez tekrar edilir; ardarda gelen iki vaad gibidir. 'Zorluk' tektir, 'kolaylık' ikiye katlanmıştır demişlerdir.", psy: "hope", cat: ["hope", "sadness", "anxiety"] },
  { sure: 40, ayet: 60, meal: "Rabbiniz dedi ki: «Bana dua edin, kabul edeyim.»", tefsir: "Dua bir istek değil, Allah'ın bir emri ve vaadidir. Duanın kabulü garantidir; sabır ise zamanlamanın Allah'a bırakılmasıdır.", psy: "hope", cat: ["hope", "guidance"] },
  { sure: 65, ayet: 2, meal: "Kim Allah'tan korkarsa, Allah ona bir çıkış yolu açar ve onu hesap etmediği yerden rızıklandırır.", tefsir: "Takvanın somut bir meyvesi: zorluklarda beklenmedik çıkış yolları. Kur'an'da 'tevekkül' ve 'rizik' kavramlarını birleştiren önemli ayet.", psy: "hope", cat: ["hope", "anxiety", "guidance"] },
  { sure: 15, ayet: 56, meal: "«Allah'ın rahmetinden, sapıklar dışında kim ümit keser» dedi.", tefsir: "Hz. İbrahim'in sözü; ümitsizliği sapıklıkla özdeşleştiren güçlü bir iman ifadesi. Mümin her koşulda rahmet kapısının açık olduğunu bilir.", psy: "hope", cat: ["hope"] },

  // ── KAYGI / ANXIETY ───────────────────────────────────────────────────────
  { sure: 2, ayet: 286, meal: "Allah bir kimseyi, ancak gücünün yettiği şeyle yükümlü kılar. Herkesin kazandığı iyilik kendi yararına, kötülük de kendi zararınadır.", tefsir: "Allah hiçbir kulunu taşıyamayacağı bir yükle yüklemiyor. Kaygılandıran her durumda bu ilahi güvenceyi hatırlamak rahatlatıcıdır.", psy: "relief", cat: ["anxiety", "guidance"] },
  { sure: 9, ayet: 51, meal: "De ki: «Allah'ın bizim için yazdıklarından başkası bize asla erişmez. O bizim Mevlâmızdır.»", tefsir: "Kader inancının kaygıyı gidermesi: bize ulaşacak olan mutlaka ulaşır, ulaşmayacak da ulaşmaz. Bu bilgi bir huzur kaynağıdır.", psy: "peace", cat: ["anxiety", "fear", "confidence"] },
  { sure: 58, ayet: 7, meal: "Üç kişinin gizli konuşması olsa dördüncüsü mutlaka O'dur; beş kişi olsa altıncısı O'dur. Bunlardan az ya da çok olsalar, nerede bulunurlarsa bulunlar O onlarla beraberdir.", tefsir: "Allah her yerde her zaman hazırdır; bu hem bir güvence hem de bir şuurdur. Yalnız hissetmek aslında bir yanılsamadır.", psy: "peace", cat: ["anxiety", "loneliness"] },
  { sure: 50, ayet: 16, meal: "Andolsun, insanı biz yarattık ve nefsinin kendisine ne vesveseler verdiğini biliriz; Biz ona şah damarından daha yakınız.", tefsir: "Allah'ın yakınlığı hem biliş hem de varlık düzeyindedir. Şah damarı metaforu, bu yakınlığın somutlaştırılamayacak derinliğini ifade eder.", psy: "peace", cat: ["anxiety", "loneliness", "guidance"] },
  { sure: 39, ayet: 16, meal: "İşte Allah kullarını böyle sakındırıyor. Ey kullarım! Benden korkun.", tefsir: "Korku burada saygı ve kulluk bilinciyle birleşir. Allah'tan korkuyu hatırlamak diğer korkuları küçültür.", psy: "guidance", cat: ["anxiety", "fear"] },

  // ── ÖFKE / ANGER ──────────────────────────────────────────────────────────
  { sure: 3, ayet: 134, meal: "Onlar, bollukta da darlıkta da Allah için harcarlar, öfkelerini yutarlar ve insanları bağışlarlar. Allah da güzel davranışta bulunanları sever.", tefsir: "Öfkeyi yutmak öfkeyi bastırmak değil, ona akıl ve iman süzgecinden geçirerek egemen olmaktır. Bu güzel ahlakın zirvesidir.", psy: "strength", cat: ["anger", "forgiveness"] },
  { sure: 42, ayet: 37, meal: "Büyük günahlardan ve hayasızlıklardan kaçınanlar; öfkelendiklerinde bağışlayanlar.", tefsir: "Öfke anında affetmek, insanın öz kontrolünün en üst noktasıdır. Kur'an bunu günahlardan kaçınmayla aynı düzeyde zikreder.", psy: "strength", cat: ["anger", "forgiveness"] },
  { sure: 42, ayet: 40, meal: "Bir kötülüğün karşılığı onun gibi bir kötülüktür; kim affeder ve ıslah ederse mükâfatı Allah'a aittir.", tefsir: "Öç almak bir hak olmakla birlikte affetmek daha yücedir. Allah affedenin ödülünü bizzat üstlenir.", psy: "strength", cat: ["anger", "forgiveness"] },
  { sure: 4, ayet: 148, meal: "Allah, kötü sözün yüksek sesle söylenmesini sevmez; zulme uğrayan hariç.", tefsir: "Öfkeyi sesle ifade etmek yalnızca haksızlığa maruz kalanda meşrudur. Bunun dışında kötü söz Allah'ın sevmediği bir davranıştır.", psy: "guidance", cat: ["anger", "justice"] },
  { sure: 31, ayet: 18, meal: "İnsanlara yanağını şişirerek bakma ve yeryüzünde böbürlenerek yürüme. Şüphesiz Allah, kibirli ve kendini beğenmiş kimseleri sevmez.", tefsir: "Kibir ve öfke zaman zaman beraber yürür. Böbürlenmek kalbin hastalandığının işaretidir; tevazu ise ruhun sağlığıdır.", psy: "guidance", cat: ["anger", "guidance"] },
  { sure: 25, ayet: 63, meal: "Rahman'ın kulları yeryüzünde alçakgönüllülükle yürüyen kimselerdir. Cahiller onlara sataştığında «Selam!» derler geçerler.", tefsir: "İslam ahlakının öfkeye en güzel cevabı: nazik ve tokgözlü olmak. Selam demek zafiyeti değil olgunluğu ifade eder.", psy: "peace", cat: ["anger", "peace"] },

  // ── SUÇ / GUILT & TÖVBE ───────────────────────────────────────────────────
  { sure: 4, ayet: 17, meal: "Allah'ın kabul etmeyi üstlendiği tövbe, cehalet sebebiyle kötülük yapıp sonra çok geçmeden tövbe edenlerin tövbesidir. İşte Allah bunların tövbesini kabul eder.", tefsir: "Tövbenin kabul şartı zaman kaybetmemektir. İnsan hata yapar, önemli olan çabuk dönmektir.", psy: "redemption", cat: ["guilt", "forgiveness"] },
  { sure: 3, ayet: 135, meal: "Onlar, bir çirkin iş yaptıklarında ya da kendilerine zulmettiklerinde Allah'ı anarlar ve günahları için bağışlanma dilerler.", tefsir: "Günahı hemen Allah'a götürmek hem pişmanlığın hem de imanın işaretidir. Günahın ardından gelen tevbe de Allah'ın rahmeti içindedir.", psy: "redemption", cat: ["guilt", "forgiveness"] },
  { sure: 9, ayet: 104, meal: "Allah'ın, kullarından tövbeyi kabul ettiğini, sadakaları aldığını ve çok tövbe kabul eden, çok merhamet eden olduğunu bilmiyorlar mı?", tefsir: "Allah yalnızca tövbeyi kabul etmekle kalmaz, hayırseverliği de bir arınma aracı olarak alır. Rahman ve Rahim olmak O'nun iki temel sıfatıdır.", psy: "hope", cat: ["guilt", "hope"] },
  { sure: 25, ayet: 70, meal: "Ancak tövbe edip iman eden ve salih amel işleyenler başka. Allah onların kötülüklerini iyiliklere çevirir.", tefsir: "Tövbenin mucizesi: günahlar yalnızca silinmez, iyiliklere dönüşür. Bu dönüşüm Allah'ın sonsuz rahmetinin tecellisidir.", psy: "redemption", cat: ["guilt", "hope", "forgiveness"] },
  { sure: 5, ayet: 39, meal: "Kim (haksızlıktan) vazgeçer ve kendini ıslah ederse, şüphesiz Allah onun tövbesini kabul eder; Allah bağışlayandır, merhamet edendir.", tefsir: "Haksızlıktan dönüş ve kendini ıslah etme, affın iki şartıdır. Allah bu şartları yerine getireni bağışlar.", psy: "redemption", cat: ["guilt", "forgiveness"] },
  { sure: 66, ayet: 8, meal: "Ey iman edenler! Samimi bir tövbeyle Allah'a dönün; umulur ki Rabbiniz kötülüklerinizi örter.", tefsir: "Samimi tövbe (nasuh tövbe); bütün kalbiyle, gerçekten dönüş. Allah bu samimi dönüşü hem örter hem de ödüllendirir.", psy: "redemption", cat: ["guilt", "hope"] },

  // ── AFFETME / FORGIVENESS ─────────────────────────────────────────────────
  { sure: 24, ayet: 22, meal: "Aralarında fazilet ve genişlik olanlar, akrabaya, yoksullara ve Allah yolunda göç edenlere bir şey vermeyeceklerine yemin etmesin. Affetsinler ve müsamaha göstersinler. Allah'ın sizi bağışlamasını ister misiniz?", tefsir: "Kişinin kendisi bağışlanmak istiyorsa başkasını bağışlaması gerekir. Allah'ın affı ile insanın affı arasında kurulmuş derin bir ilişki.", psy: "healing", cat: ["forgiveness", "gratitude"] },
  { sure: 45, ayet: 14, meal: "Müminlere söyle: Allah'ın her güne ait bir cezalandırma beklemeyen kimseleri bağışlasınlar.", tefsir: "İnsanları bağışlamak Allah'ın hesabını insanın hesabına bırakmak demektir. Bu yüce bir güven ve tevekkül işaretidir.", psy: "peace", cat: ["forgiveness", "justice"] },
  { sure: 64, ayet: 14, meal: "Eğer affeder, kusurlarını görmezden gelir ve bağışlarsanız, şüphesiz Allah çok bağışlayandır, çok merhamet edendir.", tefsir: "Affetmek insanı Allah'ın sıfatlarıyla buluşturur. Bağışlamak Allah'a benzemektir.", psy: "healing", cat: ["forgiveness"] },
  { sure: 73, ayet: 10, meal: "Onların söylediklerine sabret ve onlardan güzellikle uzaklaş.", tefsir: "Affetmek zaman zaman susarak ve zarif bir şekilde uzaklaşmaktır. Zarardan uzak durmak da bir affedişin parçası olabilir.", psy: "peace", cat: ["forgiveness", "patience"] },
  { sure: 2, ayet: 263, meal: "Güzel bir söz ve bağışlamak, peşinden eza gelen sadakadan daha hayırlıdır.", tefsir: "Affedici bir dil ve nazik davranış, maddi bir vermekten daha kıymetlidir. Kalpleri yaralamamak, onları sarmakla başlar.", psy: "peace", cat: ["forgiveness", "gratitude"] },

  // ── ŞÜKÜR / GRATITUDE ─────────────────────────────────────────────────────
  { sure: 14, ayet: 7, meal: "Rabbiniz şöyle buyurdu: «Eğer şükrederseniz, elbette size nimetimi artırırım; eğer nankörlük ederseniz, şüphesiz azabım çok şiddetlidir.»", tefsir: "Şükür bir ahlak değil aynı zamanda bir stratejidir; nimetlerin artmasının formülü. Nankörlük ise nimeti azaltan bir kördüğüm.", psy: "gratitude", cat: ["gratitude"] },
  { sure: 31, ayet: 12, meal: "Andolsun, Lokman'a 'Allah'a şükret' diye hikmet verdik. Kim şükrederse kendi iyiliği için şükreder; kim nankörlük ederse, şüphesiz Allah zengindir.", tefsir: "Şükür önce şükredenin kendi ruhunu besler. Allah'ın şükre ihtiyacı yoktur, şükür aslında insanın kendi kalkınmasıdır.", psy: "gratitude", cat: ["gratitude", "guidance"] },
  { sure: 16, ayet: 18, meal: "Allah'ın nimetlerini sayacak olsanız bitiremezsiniz. Şüphesiz Allah çok bağışlayandır, çok merhamet edendir.", tefsir: "Şikâyet etmeden önce nimeti saymak perspektifi değiştirir. Sonsuz nimeti sayamayız; yapabileceğimiz en az şükretmektir.", psy: "gratitude", cat: ["gratitude"] },
  { sure: 2, ayet: 152, meal: "Siz beni hatırlayın, ben de sizi hatırlayayım; bana şükredin, nankörlük etmeyin.", tefsir: "Zikir ve şükür el ele yürür. Allah'ı anmak O'nun bizi anmasını getirir; bu karşılıklılık ilişkisi imanın özüdür.", psy: "peace", cat: ["gratitude", "peace", "guidance"] },
  { sure: 34, ayet: 13, meal: "Ey Davud ailesi! Şükür belirtisi olarak çalışın. Kullarımdan şükredenler azdır.", tefsir: "Şükür sözden ibaret değildir; emek, çalışma ve güzel üretim de şükrün ifadesidir. Gerçek şükür hem kalben hem de amelen yaşanır.", psy: "strength", cat: ["gratitude", "guidance"] },
  { sure: 76, ayet: 3, meal: "Biz ona yolu gösterdik; ya şükredici ya da nankör olur.", tefsir: "İnsan özgür irade sahibidir: nimet karşısında iki seçenek vardır. Şükür ya da nankörlük; birini seçmek karakteri ortaya koyar.", psy: "guidance", cat: ["gratitude", "guidance"] },

  // ── KORKU / FEAR ──────────────────────────────────────────────────────────
  { sure: 3, ayet: 173, meal: "Onlar, «Düşmanlarınız olan insanlar size karşı asker topladı, onlardan korkun» denildiğinde bu söz onların imanını artırdı ve «Allah bize yeter; O ne güzel vekildir!» dediler.", tefsir: "Hasbünallah duası; korku anında teslimiyetin en güçlü ifadesi. Bu söz korkuyu imanla eritir.", psy: "strength", cat: ["fear", "anxiety", "confidence"] },
  { sure: 8, ayet: 2, meal: "Gerçek müminler ancak o kimselerdir ki Allah anıldığında kalpleri titrer, kendilerine Allah'ın âyetleri okunduğunda bu onların imanını artırır.", tefsir: "Allah'tan duyulan korku (haşyet) kalbi inceltir, hassaslaştırır. Bu korku insanı küçük korkulara esir olmaktan kurtarır.", psy: "guidance", cat: ["fear", "guidance"] },
  { sure: 55, ayet: 46, meal: "Rabbinin makamından korkan ve nefsini kötü arzulardan men eden kimse için iki cennet vardır.", tefsir: "İlahi korku (haşyet) insanı ödüle götürür; dünyevi korku ise insanı felç eder. Birini taşıyan diğerini aşar.", psy: "hope", cat: ["fear", "hope"] },
  { sure: 35, ayet: 18, meal: "Hiçbir yük taşıyıcı, başkasının yükünü taşımaz. Ağırlığı altında bunalan bir kimse yakını bile olsa onun yükünü taşıması için başka birini çağırsa taşınmaz. Sen ancak görmedikleri halde Rablerinden korkan ve namaz kılanları uyarabilirsin.", tefsir: "Her insanın kendi hesabı kendine aittir; bu bilgi hem sorumluluğu hem de özgürlüğü getirir. Gerçek korku Allah'a karşı duyulanıdır.", psy: "guidance", cat: ["fear", "guidance"] },

  // ── ADALET / JUSTICE ──────────────────────────────────────────────────────
  { sure: 4, ayet: 135, meal: "Ey iman edenler! Kendiniz, anne-babanız ve yakınlarınız aleyhine bile olsa adaleti titizlikle ayakta tutan, Allah için tanıklık eden kimseler olun.", tefsir: "Adaletin en büyük sınavı kendi çıkarımıza aykırı olduğu andır. Kur'an adalet için bu en zor şartı şart koşar.", psy: "strength", cat: ["justice", "guidance"] },
  { sure: 5, ayet: 8, meal: "Ey iman edenler! Allah için hakkı titizlikle ayakta tutan, adil şahitler olun. Bir topluma olan kininiz sizi adaletsiz davranmaya itmesin.", tefsir: "Düşmanlık adalet duygusunu köreltemez. Tarafsız ve adil olmak kişisel duygulardan üstün tutulması gereken bir ilkedir.", psy: "strength", cat: ["justice"] },
  { sure: 16, ayet: 90, meal: "Şüphesiz Allah, adaleti, iyilik yapmayı ve yakınlara yardım etmeyi emreder; çirkin işleri, kötülüğü ve zulmü yasaklar.", tefsir: "Adalet, ihsan ve sıla-ı rahim; İslam'ın toplumsal ahlak üçlüsü. Bunların zıddı olan fuhşiyat, münker ve bağy ise yasaklanır.", psy: "guidance", cat: ["justice", "guidance"] },
  { sure: 6, ayet: 152, meal: "Ölçüyü ve tartıyı adaletle yerine getirin. Biz herkese ancak gücünün yettiği kadar yükleriz.", tefsir: "Ticari adalet ibadet boyutunda ele alınmıştır. İnsanların haklarını çiğnemek aynı zamanda Allah'a karşı bir kusurdur.", psy: "guidance", cat: ["justice", "guilt"] },
  { sure: 55, ayet: 9, meal: "Tartıyı adaletle yapın ve tartıda eksik yapmayın.", tefsir: "Rahman suresinde evrenin denge üzere yaratıldığından bahsedilir; insan da bu dengeye aykırı davranmamalıdır.", psy: "guidance", cat: ["justice"] },
  { sure: 4, ayet: 58, meal: "Allah size emanetleri ehlerine vermenizi ve insanlar arasında hükmettiğinizde adaletle hükmetmenizi emreder.", tefsir: "Yönetimde ve güven ilişkilerinde iki temel: Emaneti ehline vermek ve hükümde adil olmak.", psy: "guidance", cat: ["justice", "guidance"] },

  // ── REHBERLİK / GUIDANCE ──────────────────────────────────────────────────
  { sure: 1, ayet: 6, meal: "Bizi doğru yola, kendilerine nimet verdiklerin yoluna ilet; gazaba uğrramışların ve sapkınlarınkine değil.", tefsir: "Fatiha'nın özünde yatan dua: hidayet talebi. Mümin her gün bu duayı eder; çünkü hidayet sürekli yenilenmesi gereken bir nimetin talebidir.", psy: "guidance", cat: ["guidance"] },
  { sure: 2, ayet: 2, meal: "Bu, onda şüphe olmayan kitaptır; müttakiler için yol göstericidir.", tefsir: "Kur'an'ın rehberliği yalnızca müttakiler için işlevseldir; çünkü onu alma yeteneği ancak Allah'a saygı ve duyarlılıkla gelişir.", psy: "confidence", cat: ["guidance", "confidence"] },
  { sure: 5, ayet: 16, meal: "Allah, rızasını arayanları selamet yollarına iletir ve onları izni ile karanlıklardan aydınlığa çıkarır.", tefsir: "Hidayetin ilk şartı samimiyettir. Allah'ın rızasını aramak doğru motivasyon; bunun ardından gelen rehberlik bir nimettir.", psy: "hope", cat: ["guidance", "hope"] },
  { sure: 4, ayet: 59, meal: "Allah'a itaat edin, Peygamber'e de itaat edin ve sizden olan ülü'l-emre de. Anlaşmazlığa düştüğünüzde, Allah'a ve Peygamber'e başvurun.", tefsir: "Kur'an rehberlikteki hiyerarşiyi açıklar. Anlaşmazlıkta hakeme gitmek kaostan çıkışın ilk adımıdır.", psy: "guidance", cat: ["guidance"] },
  { sure: 39, ayet: 18, meal: "Sözü dinleyip de en güzeline uyanlar; işte Allah'ın doğru yola ilettiği onlardır; işte gerçek akıl sahipleri onlardır.", tefsir: "Dinleme ve en iyisini seçme yetisi gerçek aklın göstergesidir. Rehberlik bir dayatma değil, kişinin doğruyu seçmesiyle gerçekleşir.", psy: "confidence", cat: ["guidance", "confidence"] },

  // ── HUZUR / PEACE ─────────────────────────────────────────────────────────
  { sure: 13, ayet: 28, meal: "Dikkat edin, kalpler ancak Allah'ı anmakla huzur bulur.", tefsir: "Zikrin psikolojik boyutu: kalbin huzurunun yolu Allah'ı anmaktan geçer. Modern psikoloji de meditasyonun benzer etkilerini doğrular.", psy: "peace", cat: ["peace", "guidance"] },
  { sure: 48, ayet: 26, meal: "Allah, Peygamber'e ve müminlere sakinlik verdi ve onları Allah'a saygı sözü üzerinde sabitledi.", tefsir: "İlahi sekine (sakinlik): dışarıdan değil içeriden gelen bir huzurdur. Allah onu kalpten verir.", psy: "peace", cat: ["peace"] },
  { sure: 27, ayet: 62, meal: "Darda kalana yetişip sıkıntısını gideren ve sizi yeryüzünün halifeleri kılan mı? Allah ile beraber başka bir ilah mı?", tefsir: "Gerçek huzurun kaynağı Allah'tır; O sıkıntıdakilerin çağrısına cevap verendir. Bu gerçekliği bilen kalp ferahlar.", psy: "relief", cat: ["peace", "anxiety"] },
  { sure: 16, ayet: 97, meal: "Erkek veya kadın, mümin olarak kim güzel iş yaparsa, onu mutlaka güzel bir hayatla yaşatırız.", tefsir: "Huzurlu hayat rastlantı değil imanla yapılan amelin bir sonucudur. Cins ayrımı olmaksızın bu vaad herkese yöneliktir.", psy: "hope", cat: ["peace", "hope"] },
  { sure: 41, ayet: 30, meal: "«Rabbimiz Allah'tır» deyip sonra dosdoğru yürüyenlerin üzerine melekler iner: «Korkmayın, üzülmeyin; size va'dolunan cennetle sevinin!»", tefsir: "İstikametli bir hayatın meyvesi: iç huzur ve melek teminatı. Kaygı ve korku bu huzura dayanan kişinin üzerinden kalkar.", psy: "peace", cat: ["peace", "anxiety", "hope"] },
  { sure: 57, ayet: 4, meal: "O, gökleri ve yeri altı günde yaratan; sonra Arş'a hükmeden, yere gireni ve oradan çıkanı, gökten ineni ve oraya yükseleni bilendir. Nerede olsanız O sizinle beraberdir.", tefsir: "Allah'ın sürekli beraberliği; yalnızlığı ve kaygıyı gideren bir ilahi varlık. Bu bilgi huzurun en derin kaynağıdır.", psy: "peace", cat: ["peace", "loneliness"] },

  // ── GÜVEN / CONFIDENCE ────────────────────────────────────────────────────
  { sure: 9, ayet: 40, meal: "Hani, kâfirler onu iki kişiden biri olarak mağaraya çıkarmışlardı. O, arkadaşına «Üzülme, şüphesiz Allah bizimle beraberdir» demişti.", tefsir: "Hz. Peygamber'in Sevr mağarasında Hz. Ebu Bekir'e söylediği söz. En zor anda Allah'ın beraberliğini hatırlamak en güçlü güven kaynağıdır.", psy: "confidence", cat: ["confidence", "anxiety"] },
  { sure: 49, ayet: 15, meal: "Müminler, yalnız Allah'a ve Peygamberine iman eden, sonra hiç şüpheye düşmeksizin Allah yolunda mallarıyla ve canlarıyla cihad edenlerdir.", tefsir: "Gerçek imanın şüpheden arınmış olması güveni beraberinde getirir. Şüphesiz iman sarsılmaz bir özgüven zemini oluşturur.", psy: "strength", cat: ["confidence", "guidance"] },
  { sure: 33, ayet: 3, meal: "Allah'a tevekkül et; vekil olarak Allah yeter.", tefsir: "Tevekkülün özü: Allah'ı vekil tutmak. Kendine güvensizlik Allah'a güvenle aşılır; güven karakter zayıflığı değil olgunluktur.", psy: "confidence", cat: ["confidence", "anxiety"] },
  { sure: 2, ayet: 255, meal: "Allah; O'ndan başka hiçbir ilah yoktur. Diridir, kâimdir. O'nu ne bir uyuklama ne de uyku tutmaz.", tefsir: "Ayetu'l-Kursi; Allah'ın sonsuz kudretini ve uyanıklığını anlatan en kapsamlı ayet. Bu gerçeği bilen kalp güvende olduğunu bilir.", psy: "confidence", cat: ["confidence", "peace"] },
  { sure: 67, ayet: 2, meal: "O ki, hanginizin daha güzel iş yapacağını denemek için ölümü de hayatı da yarattı; O mutlak güçlüdür, çok bağışlayandır.", tefsir: "Hayatın anlamı güzel iş yapmaktır. Bu amaçla yaşamak bir insan için en sağlam güven zeminini oluşturur.", psy: "strength", cat: ["confidence", "guidance"] },

  // ── YALNIZLIK / LONELINESS ────────────────────────────────────────────────
  { sure: 2, ayet: 186, meal: "Kullarım beni senden soracak olursa, muhakkak ki ben onlara yakınım. Bana dua ettiği zaman dua edenin dileğine karşılık veririm.", tefsir: "Allah'ın yakınlığı dua ile somutlaşır. Yalnızlık hissi Allah'ın bizden uzak olduğu değil, bizim O'nu aramadığımızın işareti olabilir.", psy: "comfort", cat: ["loneliness", "hope"] },
  { sure: 51, ayet: 50, meal: "Allah'a doğru kaçın; şüphesiz ben O'nun tarafından size açık bir uyarıcıyım.", tefsir: "Allah'a sığınmak her sığınaktan güçlüdür. Yalnızlık ve boşluk hissini dolduran tek şey O'na yönelmektir.", psy: "comfort", cat: ["loneliness", "guidance"] },
  { sure: 6, ayet: 3, meal: "Göklerde ve yerde ilah O'dur. Gizlinizi de açığınızı da bilir; ne kazandığınızı da bilir.", tefsir: "Allah her yerdedir ve her şeyi bilir; bu hem bir hesap bilinci hem de bir güven hissi oluşturur. Yalnız değilsiniz.", psy: "comfort", cat: ["loneliness", "guidance"] },

  // ── HASRET / LONGING ──────────────────────────────────────────────────────
  { sure: 2, ayet: 156, meal: "Onlar, başlarına bir musibet geldiğinde 'Biz şüphesiz Allah'a aidiz ve O'na döneceğiz' derler.", tefsir: "Kayıp ve hasret anında söylenen bu söz hem bir teslimiyet hem de bir buluşma umudu taşır. Her ayrılık bir buluşmaya açılan kapıdır.", psy: "comfort", cat: ["longing", "sadness"] },
  { sure: 28, ayet: 24, meal: "(Musa): «Rabbim! Şüphesiz bana indireceğin her iyiliğe muhtacım» dedi.", tefsir: "Hz. Musa'nın kimsesiz ve yoksul kaldığı anda Allah'a sığınması. Hasret anında Allah'a ihtiyacı ifade etmek en saf duadır.", psy: "comfort", cat: ["longing", "guidance"] },
  { sure: 3, ayet: 185, meal: "Her can ölümü tadacaktır. Kıyamet günü ecirleriniz tastamam verilecektir. Kim cehennemden uzaklaştırılıp cennete sokulursa gerçekten kurtulmuştur.", tefsir: "Ölüm ve ayrılık evrensel bir deneyimdir; ama son söz hesap günüdür. Hasret dünya sonrasında kavuşmaya dönüşecektir.", psy: "hope", cat: ["longing", "fear", "hope"] },
  { sure: 62, ayet: 8, meal: "Kaçtığınız ölüm şüphesiz sizi bulacaktır; sonra görüleni de görülmeyeni de bilen Allah'a döndürüleceksiniz.", tefsir: "Ölümden ve ayrılıktan kaçınılamaz; önemli olan bu kaçınılmaz gerçeği imanla karşılamaktır.", psy: "guidance", cat: ["longing", "fear"] },
];

// ── Mevcut ayahs.json'dan havuza ekle ────────────────────────────────────────
function buildFromExisting(existingAyahs) {
  const entries = [];
  for (const a of existingAyahs) {
    const emotionCats = tagsToEmotions(a.tags || []);
    if (emotionCats.length === 0) continue;
    entries.push({
      id: `ayet_${a.surahNumber}_${a.ayahNumber}`,
      sure: a.surahNumber,
      ayet: a.ayahNumber,
      meal: a.text_tr || "",
      tefsir_notu: a.short_explanation || a.notes || "",
      esbab_i_nuzul: "Diyanet ve klasik tefsir kaynaklarına göre düzenlenmiştir.",
      kategori: emotionCats[0], // Birincil kategori
      kategoriler: emotionCats, // Tüm kategoriler
      psy_impact: tagsToPsy(a.tags || []),
      ilgili_ayetler: [],
      scholar_approved: false,
      kaynak: "ayahs.json (doğrulanmış)",
    });
  }
  return entries;
}

function tagsToEmotions(tags) {
  const map = {
    "sabır": ["patience", "sadness"],
    "umut": ["hope"],
    "tövbe": ["guilt", "forgiveness"],
    "yalnızlık": ["loneliness"],
    "şifa": ["anxiety", "fear"],
    "kaygı": ["anxiety"],
    "korku": ["fear"],
    "öfke": ["anger"],
    "hüzün": ["sadness"],
    "sevinç": ["gratitude"],
    "haset": ["anger"],
    "kibir": ["anger"],
    "haramlar": ["guilt"],
    "iyilikler": ["gratitude"],
    "gıybet": ["guilt", "justice"],
    "infak": ["gratitude"],
    "emanet": ["justice"],
    "doğruluk": ["guidance", "confidence"],
    "ahiret": ["fear", "hope"],
    "ölüm": ["fear"],
    "iman": ["confidence", "hope"],
    "adalet": ["justice"],
    "kul hakkı": ["guilt", "justice"],
    "evlilik": ["guidance", "peace"],
    "helal": ["guidance"],
    "aile": ["guidance", "peace"],
    "tevekkül": ["confidence", "peace"],
    "dua": ["hope", "guidance"],
    "Kur'an": ["guidance"],
    "peygamberler": ["guidance", "confidence"],
    "rahmet": ["hope", "forgiveness"],
    "haksızlık": ["justice"],
    "zulüm": ["justice"],
    "takva": ["confidence", "guidance"],
    "çocuk": ["guidance"],
    "anne-baba": ["guidance"],
    "hesap": ["fear"],
    "ölçü": ["justice"],
    "merhamet": ["forgiveness", "peace"],
    "huzur": ["peace"],
  };
  const result = new Set();
  for (const tag of tags) {
    const cats = map[tag];
    if (cats) cats.forEach(c => result.add(c));
  }
  return result.size > 0 ? Array.from(result) : ["guidance"];
}

function tagsToPsy(tags) {
  if (tags.includes("sabır") || tags.includes("kaygı")) return "strength";
  if (tags.includes("umut") || tags.includes("tövbe")) return "hope";
  if (tags.includes("yalnızlık")) return "comfort";
  if (tags.includes("şifa")) return "relief";
  if (tags.includes("öfke")) return "guidance";
  if (tags.includes("sevinç") || tags.includes("iyilikler")) return "gratitude";
  if (tags.includes("korku") || tags.includes("ahiret")) return "guidance";
  if (tags.includes("iman")) return "confidence";
  return "guidance";
}

// ── Ek ayetleri entegre et ────────────────────────────────────────────────────
function buildAdditional() {
  return ADDITIONAL_AYAHS.map(a => ({
    id: `ayet_${a.sure}_${a.ayet}`,
    sure: a.sure,
    ayet: a.ayet,
    meal: a.meal,
    tefsir_notu: a.tefsir,
    esbab_i_nuzul: "Diyanet meal referans alınmıştır. Detaylı esbâb-ı nüzûl için tefsir kaynaklarına başvurun.",
    kategori: Array.isArray(a.cat) ? a.cat[0] : a.cat,
    kategoriler: Array.isArray(a.cat) ? a.cat : [a.cat],
    psy_impact: a.psy,
    ilgili_ayetler: [],
    scholar_approved: false,
    kaynak: "ek (alim incelemesi gerekli)",
  }));
}

// ── Havuzu organize et ────────────────────────────────────────────────────────
function organizeByCategory(allEntries) {
  const categories = {
    sadness:     { id: "psy_001", isim: "Üzüntü ve Keder",     emoji: "😢", ayetler: [] },
    anxiety:     { id: "psy_002", isim: "Kaygı ve Endişe",     emoji: "😰", ayetler: [] },
    anger:       { id: "psy_003", isim: "Öfke",                emoji: "😠", ayetler: [] },
    guilt:       { id: "psy_004", isim: "Pişmanlık ve Suçluluk",emoji: "😔", ayetler: [] },
    loneliness:  { id: "psy_005", isim: "Yalnızlık",           emoji: "🌙", ayetler: [] },
    longing:     { id: "psy_006", isim: "Hasret ve Özlem",     emoji: "💔", ayetler: [] },
    hope:        { id: "psy_007", isim: "Umut",                emoji: "✨", ayetler: [] },
    patience:    { id: "psy_008", isim: "Sabır",               emoji: "🌿", ayetler: [] },
    forgiveness: { id: "psy_009", isim: "Affetmek",            emoji: "🤝", ayetler: [] },
    gratitude:   { id: "psy_010", isim: "Şükür ve Minnet",     emoji: "🙏", ayetler: [] },
    fear:        { id: "psy_011", isim: "Korku",               emoji: "😨", ayetler: [] },
    justice:     { id: "psy_012", isim: "Adalet",              emoji: "⚖️",  ayetler: [] },
    guidance:    { id: "psy_013", isim: "Rehberlik",           emoji: "🧭", ayetler: [] },
    peace:       { id: "psy_014", isim: "Huzur",               emoji: "☮️",  ayetler: [] },
    confidence:  { id: "psy_015", isim: "Güven ve Kararlılık", emoji: "💪", ayetler: [] },
  };

  const seen = new Set();

  for (const entry of allEntries) {
    const cats = entry.kategoriler || [entry.kategori];
    for (const cat of cats) {
      if (!categories[cat]) continue;
      const key = `${cat}:${entry.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      categories[cat].ayetler.push({ ...entry, kategori: cat });
    }
  }

  return categories;
}

// ── Ana ────────────────────────────────────────────────────────────────────────
const existingEntries  = buildFromExisting(existingAyahs);
const additionalEntries = buildAdditional();
const allEntries = [...existingEntries, ...additionalEntries];

const kategoriler = organizeByCategory(allEntries);

// Özet
let total = 0;
for (const [cat, info] of Object.entries(kategoriler)) {
  console.log(`  ${info.emoji}  ${cat.padEnd(12)} → ${info.ayetler.length} ayet`);
  total += info.ayetler.length;
}

const havuz = {
  metadata: {
    aciklama: "Emotion-based Quranic guidance pool. scholar_approved: false — requires scholarly review.",
    toplam_ayetler: total,
    toplam_kategoriler: Object.keys(kategoriler).length,
    scholar_approved: false,
    uyari: "Tefsir notları ve kategoriler AI tarafından oluşturulmuştur. Dini alim incelemesi yapılmalıdır.",
    son_guncellenme: new Date().toISOString().split("T")[0],
  },
  kategoriler,
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(havuz, null, 2), "utf8");

console.log(`\n✅ Havuz oluşturuldu: ${OUTPUT_PATH}`);
console.log(`📊 Toplam giriş (tekrar dahil): ${total}`);
console.log(`⚠️  scholar_approved: false — dini alim incelemesi gereklidir.`);
