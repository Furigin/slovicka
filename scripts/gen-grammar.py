# Генератор стартового набора data/grammar.json (глаголы и существительные A1).
# ВНИМАНИЕ: формы сгенерированы и помечены verified: false — проверь их с преподавателем.
# Запуск: python scripts/gen-grammar.py  (перезапишет data/grammar.json!)
import json

V = [
    ("byt", "byť", "быть", "som si je sme ste sú"),
    ("mat", "mať", "иметь", "mám máš má máme máte majú"),
    ("robit", "robiť", "делать", "robím robíš robí robíme robíte robia"),
    ("hovorit", "hovoriť", "говорить", "hovorím hovoríš hovorí hovoríme hovoríte hovoria"),
    ("byvat", "bývať", "жить, проживать", "bývam bývaš býva bývame bývate bývajú"),
    ("studovat", "študovať", "учиться (в вузе), изучать", "študujem študuješ študuje študujeme študujete študujú"),
    ("ist", "ísť", "идти", "idem ideš ide ideme idete idú"),
    ("chciet", "chcieť", "хотеть", "chcem chceš chce chceme chcete chcú"),
    ("moct", "môcť", "мочь", "môžem môžeš môže môžeme môžete môžu"),
    ("vediet", "vedieť", "знать, уметь", "viem vieš vie vieme viete vedia"),
    ("pracovat", "pracovať", "работать", "pracujem pracuješ pracuje pracujeme pracujete pracujú"),
    ("citat", "čítať", "читать", "čítam čítaš číta čítame čítate čítajú"),
    ("pisat", "písať", "писать", "píšem píšeš píše píšeme píšete píšu"),
    ("rozumiet", "rozumieť", "понимать", "rozumiem rozumieš rozumie rozumieme rozumiete rozumejú"),
    ("vidiet", "vidieť", "видеть", "vidím vidíš vidí vidíme vidíte vidia"),
    ("pocut", "počuť", "слышать", "počujem počuješ počuje počujeme počujete počujú"),
    ("jest", "jesť", "есть (кушать)", "jem ješ je jeme jete jedia"),
    ("pit", "piť", "пить", "pijem piješ pije pijeme pijete pijú"),
    ("spat", "spať", "спать", "spím spíš spí spíme spíte spia"),
    ("ucit-sa", "učiť sa", "учиться", "učím sa|učíš sa|učí sa|učíme sa|učíte sa|učia sa"),
    ("volat-sa", "volať sa", "называться, зваться", "volám sa|voláš sa|volá sa|voláme sa|voláte sa|volajú sa"),
    ("chodit", "chodiť", "ходить", "chodím chodíš chodí chodíme chodíte chodia"),
    ("cestovat", "cestovať", "путешествовать, ездить", "cestujem cestuješ cestuje cestujeme cestujete cestujú"),
    ("kupovat", "kupovať", "покупать", "kupujem kupuješ kupuje kupujeme kupujete kupujú"),
    ("platit", "platiť", "платить", "platím platíš platí platíme platíte platia"),
    ("varit", "variť", "варить, готовить", "varím varíš varí varíme varíte varia"),
    ("pytat-sa", "pýtať sa", "спрашивать", "pýtam sa|pýtaš sa|pýta sa|pýtame sa|pýtate sa|pýtajú sa"),
    ("odpovedat", "odpovedať", "отвечать", "odpovedám odpovedáš odpovedá odpovedáme odpovedáte odpovedajú"),
    ("potrebovat", "potrebovať", "нуждаться", "potrebujem potrebuješ potrebuje potrebujeme potrebujete potrebujú"),
    ("musiet", "musieť", "быть должным", "musím musíš musí musíme musíte musia"),
    ("poznat", "poznať", "знать (быть знакомым)", "poznám poznáš pozná poznáme poznáte poznajú"),
    ("brat", "brať", "брать", "beriem berieš berie berieme beriete berú"),
    ("stat", "stáť", "стоять; стоить", "stojím stojíš stojí stojíme stojíte stoja"),
    ("sediet", "sedieť", "сидеть", "sedím sedíš sedí sedíme sedíte sedia"),
    ("hrat", "hrať", "играть", "hrám hráš hrá hráme hráte hrajú"),
    ("pocuvat", "počúvať", "слушать", "počúvam počúvaš počúva počúvame počúvate počúvajú"),
    ("pozerat", "pozerať", "смотреть", "pozerám pozeráš pozerá pozeráme pozeráte pozerajú"),
    ("mysliet", "myslieť", "думать", "myslím myslíš myslí myslíme myslíte myslia"),
    ("zacinat", "začínať", "начинать", "začínam začínaš začína začíname začínate začínajú"),
    ("koncit", "končiť", "заканчивать", "končím končíš končí končíme končíte končia"),
    ("bezat", "bežať", "бежать", "bežím bežíš beží bežíme bežíte bežia"),
    ("lezat", "ležať", "лежать", "ležím ležíš leží ležíme ležíte ležia"),
    ("spievat", "spievať", "петь", "spievam spievaš spieva spievame spievate spievajú"),
    ("tancovat", "tancovať", "танцевать", "tancujem tancuješ tancuje tancujeme tancujete tancujú"),
    ("nakupovat", "nakupovať", "делать покупки", "nakupujem nakupuješ nakupuje nakupujeme nakupujete nakupujú"),
]

# (id, lemma, ru, род, образец, это_сам_образец, категория, ед. ч., мн. ч. | None, доп.)
# Падежи по порядку: nom gen dat acc loc ins.  locPrep — предлог для «где?» вместо «v» (na/pri).
N = [
    ("chlap", "chlap", "мужчина, парень", "m", "chlap", True, "person", "chlap chlapa chlapovi chlapa chlapovi chlapom", "chlapi chlapov chlapom chlapov chlapoch chlapmi", {}),
    ("hrdina", "hrdina", "герой", "m", "hrdina", True, "person", "hrdina hrdinu hrdinovi hrdinu hrdinovi hrdinom", "hrdinovia hrdinov hrdinom hrdinov hrdinoch hrdinami", {}),
    ("dub", "dub", "дуб", "m", "dub", True, "thing", "dub duba dubu dub dube dubom", "duby dubov dubom duby duboch dubmi", {}),
    ("stroj", "stroj", "машина, станок", "m", "stroj", True, "thing", "stroj stroja stroju stroj stroji strojom", "stroje strojov strojom stroje strojoch strojmi", {}),
    ("zena", "žena", "женщина, жена", "f", "žena", True, "person", "žena ženy žene ženu žene ženou", "ženy žien ženám ženy ženách ženami", {}),
    ("ulica", "ulica", "улица", "f", "ulica", True, "place", "ulica ulice ulici ulicu ulici ulicou", "ulice ulíc uliciam ulice uliciach ulicami", {"locPrep": "na"}),
    ("dlan", "dlaň", "ладонь", "f", "dlaň", True, "thing", "dlaň dlane dlani dlaň dlani dlaňou", "dlane dlaní dlaniam dlane dlaniach dlaňami", {}),
    ("kost", "kosť", "кость", "f", "kosť", True, "thing", "kosť kosti kosti kosť kosti kosťou", "kosti kostí kostiam kosti kostiach kosťami", {}),
    ("mesto", "mesto", "город", "n", "mesto", True, "place", "mesto mesta mestu mesto meste mestom", "mestá miest mestám mestá mestách mestami", {}),
    ("srdce", "srdce", "сердце", "n", "srdce", True, "thing", "srdce srdca srdcu srdce srdci srdcom", "srdcia sŕdc srdciam srdcia srdciach srdcami", {}),
    ("vysvedcenie", "vysvedčenie", "аттестат, свидетельство", "n", "vysvedčenie", True, "thing", "vysvedčenie vysvedčenia vysvedčeniu vysvedčenie vysvedčení vysvedčením", "vysvedčenia vysvedčení vysvedčeniam vysvedčenia vysvedčeniach vysvedčeniami", {}),
    ("dievca", "dievča", "девочка, девушка", "n", "dievča", True, "person", "dievča dievčaťa dievčaťu dievča dievčati dievčaťom", "dievčatá dievčat dievčatám dievčatá dievčatách dievčatami", {}),
    # частые слова A1 по тем же образцам
    ("student", "študent", "студент", "m", "chlap", False, "person", "študent študenta študentovi študenta študentovi študentom", "študenti študentov študentom študentov študentoch študentmi", {}),
    ("brat", "brat", "брат", "m", "chlap", False, "person", "brat brata bratovi brata bratovi bratom", "bratia bratov bratom bratov bratoch bratmi", {}),
    ("ucitel", "učiteľ", "учитель", "m", "chlap", False, "person", "učiteľ učiteľa učiteľovi učiteľa učiteľovi učiteľom", "učitelia učiteľov učiteľom učiteľov učiteľoch učiteľmi", {}),
    ("kolega", "kolega", "коллега", "m", "hrdina", False, "person", "kolega kolegu kolegovi kolegu kolegovi kolegom", "kolegovia kolegov kolegom kolegov kolegoch kolegami", {}),
    ("obchod", "obchod", "магазин", "m", "dub", False, "place", "obchod obchodu obchodu obchod obchode obchodom", "obchody obchodov obchodom obchody obchodoch obchodmi", {}),
    ("vlak", "vlak", "поезд", "m", "dub", False, "place", "vlak vlaku vlaku vlak vlaku vlakom", "vlaky vlakov vlakom vlaky vlakoch vlakmi", {}),
    ("stol", "stôl", "стол", "m", "dub", False, "place", "stôl stola stolu stôl stole stolom", "stoly stolov stolom stoly stoloch stolmi", {"locPrep": "na"}),
    ("caj", "čaj", "чай", "m", "stroj", False, "thing", "čaj čaju čaju čaj čaji čajom", "čaje čajov čajom čaje čajoch čajmi", {}),
    ("izba", "izba", "комната", "f", "žena", False, "place", "izba izby izbe izbu izbe izbou", "izby izieb izbám izby izbách izbami", {}),
    ("skola", "škola", "школа", "f", "žena", False, "place", "škola školy škole školu škole školou", "školy škôl školám školy školách školami", {}),
    ("bratislava", "Bratislava", "Братислава", "f", "žena", False, "place", "Bratislava Bratislavy Bratislave Bratislavu Bratislave Bratislavou", None, {}),
    ("praha", "Praha", "Прага", "f", "žena", False, "place", "Praha Prahy Prahe Prahu Prahe Prahou", None, {}),
    ("kancelaria", "kancelária", "офис, кабинет", "f", "ulica", False, "place", "kancelária kancelárie kancelárii kanceláriu kancelárii kanceláriou", "kancelárie kancelárií kanceláriám kancelárie kanceláriách kanceláriami", {}),
    ("kaviaren", "kaviareň", "кафе", "f", "dlaň", False, "place", "kaviareň kaviarne kaviarni kaviareň kaviarni kaviarňou", "kaviarne kaviarní kaviarňam kaviarne kaviarňach kaviarňami", {}),
    ("viden", "Viedeň", "Вена", "f", "dlaň", False, "place", "Viedeň Viedne Viedni Viedeň Viedni Viedňou", None, {}),
    ("vec", "vec", "вещь", "f", "kosť", False, "thing", "vec veci veci vec veci vecou", "veci vecí veciam veci veciach vecami", {}),
    ("auto", "auto", "автомобиль", "n", "mesto", False, "place", "auto auta autu auto aute autom", "autá áut autám autá autách autami", {}),
    ("kino", "kino", "кинотеатр", "n", "mesto", False, "place", "kino kina kinu kino kine kinom", "kiná kín kinám kiná kinách kinami", {}),
    ("slovensko", "Slovensko", "Словакия", "n", "mesto", False, "place", "Slovensko Slovenska Slovensku Slovensko Slovensku Slovenskom", None, {"locPrep": "na"}),
    ("more", "more", "море", "n", "srdce", False, "place", "more mora moru more mori morom", "moria morí moriam moria moriach moriami", {"locPrep": "pri"}),
    ("namestie", "námestie", "площадь", "n", "vysvedčenie", False, "place", "námestie námestia námestiu námestie námestí námestím", "námestia námestí námestiam námestia námestiach námestiami", {"locPrep": "na"}),
    ("zviera", "zviera", "животное", "n", "dievča", False, "thing", "zviera zvieraťa zvieraťu zviera zvierati zvieraťom", "zvieratá zvierat zvieratám zvieratá zvieratách zvieratami", {}),
]

verbs = []
for id_, inf, ru, forms in V:
    f = forms.split("|") if "|" in forms else forms.split()
    assert len(f) == 6, (id_, f)
    verbs.append({"id": "v-" + id_, "inf": inf, "ru": ru, "present": f, "verified": False})

nouns = []
for id_, lemma, ru, g, pat, model, cat, sg, pl, extra in N:
    s = sg.split()
    assert len(s) == 6, id_
    p = pl.split() if pl else None
    if p:
        assert len(p) == 6, id_
    d = {"id": "n-" + id_, "lemma": lemma, "ru": ru, "gender": g, "pattern": pat, "model": model,
         "cat": cat, "sg": s, "pl": p, "verified": False}
    d.update(extra)
    nouns.append(d)

data = {
    "_note": "Сгенерировано автоматически — все формы помечены verified:false (neoverené). Проверь с преподавателем; править можно в приложении (Nastavenia → Tabuľky tvarov).",
    "persons": ["ja", "ty", "on/ona", "my", "vy", "oni"],
    "cases": ["nom", "gen", "dat", "acc", "loc", "ins"],
    "verbs": verbs,
    "nouns": nouns,
}
with open("data/grammar.json", "w", encoding="utf-8", newline="\n") as fh:
    fh.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
print(len(verbs), "verbs,", len(nouns), "nouns,", len({n["pattern"] for n in nouns}), "patterns")
