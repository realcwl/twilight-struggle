# Twilight Struggle map connectivity audit

Transcribed and audited against the user-provided map and the matching full-resolution GMT image. Audit date: 2026-11-13.

## Result

84 country spaces + 2 superpowers = **86 standard nodes**. There are **121 undirected standard connections**: 104 regional, 8 inter-regional, and 9 to superpowers. The printed optional USSR–Chinese Civil War connection is separate: including it gives 87 spaces and 122 connections.

Every country row and every connection below was visually reviewed. The two manually entered passes agree exactly. Programmatic checks found no unknown endpoints, missing reciprocal entries, duplicate edges, self-loops, or misclassified connection types. All 86 standard nodes form one connected graph. No unresolved lines remain in this transcription. These checks establish internal consistency; visual tracing supplies the map evidence.

## Sources and interpretation

- Primary: the image supplied by the user (GMT Games LLC © 2024).
- Matching publisher image: [TS20_Game Board_1E_Web.jpg](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/Twilight+Struggle+20th+Anniversary+HOF+Edition/TS20_Game+Board_1E_Web.jpg) (10198 × 6601 pixels). The image is linked from [GMT’s 20th Anniversary product page](https://www.gmtgames.com/p-1138-twilight-struggle-20th-anniversary-hall-of-fame-edition.aspx), where GMT labels the sample as work in progress. This audit transcribes that supplied image; it does not assert that every production printing is identical.
- Rules context: [GMT 2015 rules, §2.1.5–2.1.6 and §12](https://s3-us-west-2.amazonaws.com/gmtwebsiteassets/nnts/TS_Rules-2015.pdf).
- Only a printed line establishes adjacency; proximity, geographic borders, and line crossings do not add connections.
- All entries are direct neighbors. All standard edges are undirected. The USA/Japan arrows are the two ends of one connection.
- Solid brown = regional; red dashed = inter-regional; black = superpower.
- The board’s combined spaces remain single nodes. `Czech.` is Czechoslovakia; `Port./Spain` is Portugal/Spain; `Dominican R.` is Dominican Republic; `SE African States` is Southeast African States.
- Canada and Turkey are in Europe; Libya and Egypt are in the Middle East. Southeast Asia is a subregion of Asia.
- The optional Chinese Civil War space and its USSR link are recorded separately, outside the standard adjacency lists. Under rule 12.1 it is in Asia (not Southeast Asia), but does not affect scoring cards.
- The application scenario now uses this audit through `data/scenarios/coldwar/scenario.json`; `npm test` checks both the source and generated map against the reference. The country stability and battleground columns are recorded in [maps.md, section 11](maps.md#11-audit).

## Country-by-country audit

Each row lists all direct neighbors, including links outside its scoring region and to superpowers. Degree is the total number of listed neighbors. “Checked” means the row was traced visually and matched against the connection-by-connection pass.

### Europe

| Space | Degree | All direct neighbors | Audit |
|---|---:|---|---|
| Canada | 2 | UK, USA | Checked |
| UK | 4 | Canada, Norway, Benelux, France | Checked |
| Norway | 2 | UK, Sweden | Checked |
| Sweden | 3 | Norway, Finland, Denmark | Checked |
| Finland | 2 | Sweden, USSR | Checked |
| Denmark | 2 | Sweden, W. Germany | Checked |
| Benelux | 2 | UK, W. Germany | Checked |
| W. Germany | 5 | Denmark, Benelux, E. Germany, France, Austria | Checked |
| E. Germany | 4 | W. Germany, Poland, Czech., Austria | Checked |
| Poland | 3 | E. Germany, Czech., USSR | Checked |
| Czech. | 3 | E. Germany, Poland, Hungary | Checked |
| France | 5 | UK, W. Germany, Port./Spain, Italy, Algeria | Checked |
| Austria | 4 | W. Germany, E. Germany, Hungary, Italy | Checked |
| Italy | 5 | France, Austria, Port./Spain, Yugoslavia, Greece | Checked |
| Port./Spain | 3 | France, Italy, Morocco | Checked |
| Hungary | 4 | Czech., Austria, Romania, Yugoslavia | Checked |
| Yugoslavia | 4 | Hungary, Romania, Italy, Greece | Checked |
| Romania | 4 | Hungary, Yugoslavia, Turkey, USSR | Checked |
| Bulgaria | 2 | Greece, Turkey | Checked |
| Turkey | 4 | Romania, Bulgaria, Greece, Syria | Checked |
| Greece | 4 | Italy, Yugoslavia, Bulgaria, Turkey | Checked |

### Middle East

| Space | Degree | All direct neighbors | Audit |
|---|---:|---|---|
| Libya | 2 | Tunisia, Egypt | Checked |
| Egypt | 3 | Libya, Israel, Sudan | Checked |
| Israel | 4 | Egypt, Lebanon, Syria, Jordan | Checked |
| Lebanon | 3 | Israel, Syria, Jordan | Checked |
| Syria | 3 | Turkey, Lebanon, Israel | Checked |
| Iraq | 4 | Iran, Jordan, Saudi Arabia, Gulf States | Checked |
| Iran | 3 | Iraq, Afghanistan, Pakistan | Checked |
| Jordan | 4 | Lebanon, Israel, Iraq, Saudi Arabia | Checked |
| Saudi Arabia | 3 | Jordan, Iraq, Gulf States | Checked |
| Gulf States | 2 | Iraq, Saudi Arabia | Checked |

### Asia

| Space | Degree | All direct neighbors | Audit |
|---|---:|---|---|
| Afghanistan | 3 | USSR, Iran, Pakistan | Checked |
| Pakistan | 3 | Iran, Afghanistan, India | Checked |
| India | 2 | Pakistan, Burma | Checked |
| Burma | 2 | India, Laos/Cambodia | Checked |
| Laos/Cambodia | 3 | Burma, Thailand, Vietnam | Checked |
| Thailand | 3 | Laos/Cambodia, Vietnam, Malaysia | Checked |
| Vietnam | 2 | Laos/Cambodia, Thailand | Checked |
| Malaysia | 3 | Thailand, Indonesia, Australia | Checked |
| Indonesia | 2 | Malaysia, Philippines | Checked |
| Philippines | 2 | Indonesia, Japan | Checked |
| Taiwan | 2 | South Korea, Japan | Checked |
| Japan | 4 | South Korea, Taiwan, Philippines, USA | Checked |
| South Korea | 3 | North Korea, Japan, Taiwan | Checked |
| North Korea | 2 | USSR, South Korea | Checked |
| Australia | 1 | Malaysia | Checked |

### Africa

| Space | Degree | All direct neighbors | Audit |
|---|---:|---|---|
| Morocco | 3 | Port./Spain, Algeria, West African States | Checked |
| Algeria | 4 | France, Morocco, Tunisia, Saharan States | Checked |
| Tunisia | 2 | Algeria, Libya | Checked |
| Saharan States | 2 | Algeria, Nigeria | Checked |
| West African States | 2 | Morocco, Ivory Coast | Checked |
| Ivory Coast | 2 | West African States, Nigeria | Checked |
| Nigeria | 3 | Saharan States, Ivory Coast, Cameroon | Checked |
| Cameroon | 2 | Nigeria, Zaire | Checked |
| Zaire | 3 | Cameroon, Angola, Zimbabwe | Checked |
| Angola | 3 | Zaire, Botswana, South Africa | Checked |
| South Africa | 2 | Angola, Botswana | Checked |
| Botswana | 3 | Angola, Zimbabwe, South Africa | Checked |
| Zimbabwe | 3 | Zaire, Botswana, SE African States | Checked |
| SE African States | 2 | Zimbabwe, Kenya | Checked |
| Kenya | 2 | SE African States, Somalia | Checked |
| Somalia | 2 | Kenya, Ethiopia | Checked |
| Ethiopia | 2 | Somalia, Sudan | Checked |
| Sudan | 2 | Ethiopia, Egypt | Checked |

### Central America

| Space | Degree | All direct neighbors | Audit |
|---|---:|---|---|
| Mexico | 2 | USA, Guatemala | Checked |
| Guatemala | 3 | Mexico, El Salvador, Honduras | Checked |
| El Salvador | 2 | Guatemala, Honduras | Checked |
| Honduras | 4 | Guatemala, El Salvador, Nicaragua, Costa Rica | Checked |
| Nicaragua | 3 | Honduras, Costa Rica, Cuba | Checked |
| Costa Rica | 3 | Honduras, Nicaragua, Panama | Checked |
| Panama | 2 | Costa Rica, Colombia | Checked |
| Cuba | 3 | USA, Nicaragua, Haiti | Checked |
| Haiti | 2 | Cuba, Dominican R. | Checked |
| Dominican R. | 1 | Haiti | Checked |

### South America

| Space | Degree | All direct neighbors | Audit |
|---|---:|---|---|
| Colombia | 3 | Panama, Venezuela, Ecuador | Checked |
| Venezuela | 2 | Colombia, Brazil | Checked |
| Ecuador | 2 | Colombia, Peru | Checked |
| Peru | 3 | Ecuador, Bolivia, Chile | Checked |
| Bolivia | 2 | Peru, Paraguay | Checked |
| Paraguay | 3 | Bolivia, Argentina, Uruguay | Checked |
| Chile | 2 | Peru, Argentina | Checked |
| Argentina | 3 | Chile, Paraguay, Uruguay | Checked |
| Uruguay | 3 | Paraguay, Argentina, Brazil | Checked |
| Brazil | 2 | Venezuela, Uruguay | Checked |

### Superpower

| Space | Degree | All direct neighbors | Audit |
|---|---:|---|---|
| USA | 4 | Canada, Mexico, Cuba, Japan | Checked |
| USSR | 5 | Finland, Poland, Romania, Afghanistan, North Korea | Checked |

### Optional variant

| Space | Direct printed connection | Audit |
|---|---|---|
| Chinese Civil War | USSR only | Checked; excluded from standard graph |

## Connection-by-connection audit

Every standard connection appears exactly once in this checklist. Edge IDs match the JSON file.

### Europe

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E001 | Canada | UK | solid brown | Checked |
| E002 | UK | Norway | solid brown | Checked |
| E003 | UK | Benelux | solid brown | Checked |
| E004 | UK | France | solid brown | Checked |
| E005 | Norway | Sweden | solid brown | Checked |
| E006 | Sweden | Finland | solid brown | Checked |
| E007 | Sweden | Denmark | solid brown | Checked |
| E008 | Denmark | W. Germany | solid brown | Checked |
| E009 | Benelux | W. Germany | solid brown | Checked |
| E010 | W. Germany | E. Germany | solid brown | Checked |
| E011 | W. Germany | France | solid brown | Checked |
| E012 | W. Germany | Austria | solid brown | Checked |
| E013 | E. Germany | Poland | solid brown | Checked |
| E014 | E. Germany | Czech. | solid brown | Checked |
| E015 | E. Germany | Austria | solid brown | Checked |
| E016 | Poland | Czech. | solid brown | Checked |
| E017 | Czech. | Hungary | solid brown | Checked |
| E018 | France | Port./Spain | solid brown | Checked |
| E019 | France | Italy | solid brown | Checked |
| E020 | Austria | Hungary | solid brown | Checked |
| E021 | Austria | Italy | solid brown | Checked |
| E022 | Port./Spain | Italy | solid brown | Checked |
| E023 | Italy | Yugoslavia | solid brown | Checked |
| E024 | Italy | Greece | solid brown | Checked |
| E025 | Hungary | Romania | solid brown | Checked |
| E026 | Hungary | Yugoslavia | solid brown | Checked |
| E027 | Yugoslavia | Romania | solid brown | Checked |
| E028 | Yugoslavia | Greece | solid brown | Checked |
| E029 | Romania | Turkey | solid brown | Checked |
| E030 | Bulgaria | Turkey | solid brown | Checked |
| E031 | Bulgaria | Greece | solid brown | Checked |
| E032 | Turkey | Greece | solid brown | Checked |

### Middle East

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E033 | Libya | Egypt | solid brown | Checked |
| E034 | Egypt | Israel | solid brown | Checked |
| E035 | Israel | Lebanon | solid brown | Checked |
| E036 | Israel | Syria | solid brown | Checked |
| E037 | Israel | Jordan | solid brown | Checked |
| E038 | Lebanon | Syria | solid brown | Checked |
| E039 | Lebanon | Jordan | solid brown | Checked |
| E040 | Iran | Iraq | solid brown | Checked |
| E041 | Iraq | Jordan | solid brown | Checked |
| E042 | Iraq | Saudi Arabia | solid brown | Checked |
| E043 | Iraq | Gulf States | solid brown | Checked |
| E044 | Jordan | Saudi Arabia | solid brown | Checked |
| E045 | Saudi Arabia | Gulf States | solid brown | Checked |

### Asia

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E046 | Afghanistan | Pakistan | solid brown | Checked |
| E047 | Pakistan | India | solid brown | Checked |
| E048 | India | Burma | solid brown | Checked |
| E049 | Burma | Laos/Cambodia | solid brown | Checked |
| E050 | Laos/Cambodia | Thailand | solid brown | Checked |
| E051 | Laos/Cambodia | Vietnam | solid brown | Checked |
| E052 | Thailand | Vietnam | solid brown | Checked |
| E053 | Thailand | Malaysia | solid brown | Checked |
| E054 | Malaysia | Indonesia | solid brown | Checked |
| E055 | Malaysia | Australia | solid brown | Checked |
| E056 | Indonesia | Philippines | solid brown | Checked |
| E057 | Philippines | Japan | solid brown | Checked |
| E058 | Japan | Taiwan | solid brown | Checked |
| E059 | Japan | South Korea | solid brown | Checked |
| E060 | Taiwan | South Korea | solid brown | Checked |
| E061 | South Korea | North Korea | solid brown | Checked |

### Africa

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E062 | Morocco | Algeria | solid brown | Checked |
| E063 | Morocco | West African States | solid brown | Checked |
| E064 | Algeria | Tunisia | solid brown | Checked |
| E065 | Algeria | Saharan States | solid brown | Checked |
| E066 | Saharan States | Nigeria | solid brown | Checked |
| E067 | West African States | Ivory Coast | solid brown | Checked |
| E068 | Ivory Coast | Nigeria | solid brown | Checked |
| E069 | Nigeria | Cameroon | solid brown | Checked |
| E070 | Cameroon | Zaire | solid brown | Checked |
| E071 | Zaire | Angola | solid brown | Checked |
| E072 | Zaire | Zimbabwe | solid brown | Checked |
| E073 | Angola | Botswana | solid brown | Checked |
| E074 | Angola | South Africa | solid brown | Checked |
| E075 | Botswana | South Africa | solid brown | Checked |
| E076 | Botswana | Zimbabwe | solid brown | Checked |
| E077 | Zimbabwe | SE African States | solid brown | Checked |
| E078 | SE African States | Kenya | solid brown | Checked |
| E079 | Kenya | Somalia | solid brown | Checked |
| E080 | Somalia | Ethiopia | solid brown | Checked |
| E081 | Ethiopia | Sudan | solid brown | Checked |

### Central America

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E082 | Mexico | Guatemala | solid brown | Checked |
| E083 | Guatemala | El Salvador | solid brown | Checked |
| E084 | Guatemala | Honduras | solid brown | Checked |
| E085 | El Salvador | Honduras | solid brown | Checked |
| E086 | Honduras | Nicaragua | solid brown | Checked |
| E087 | Honduras | Costa Rica | solid brown | Checked |
| E088 | Nicaragua | Costa Rica | solid brown | Checked |
| E089 | Nicaragua | Cuba | solid brown | Checked |
| E090 | Costa Rica | Panama | solid brown | Checked |
| E091 | Cuba | Haiti | solid brown | Checked |
| E092 | Haiti | Dominican R. | solid brown | Checked |

### South America

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E093 | Colombia | Venezuela | solid brown | Checked |
| E094 | Colombia | Ecuador | solid brown | Checked |
| E095 | Ecuador | Peru | solid brown | Checked |
| E096 | Peru | Bolivia | solid brown | Checked |
| E097 | Peru | Chile | solid brown | Checked |
| E098 | Bolivia | Paraguay | solid brown | Checked |
| E099 | Chile | Argentina | solid brown | Checked |
| E100 | Paraguay | Argentina | solid brown | Checked |
| E101 | Paraguay | Uruguay | solid brown | Checked |
| E102 | Argentina | Uruguay | solid brown | Checked |
| E103 | Uruguay | Brazil | solid brown | Checked |
| E104 | Brazil | Venezuela | solid brown | Checked |

### Inter-regional

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E105 | Port./Spain | Morocco | red dashed | Checked |
| E106 | France | Algeria | red dashed | Checked |
| E107 | Turkey | Syria | red dashed | Checked |
| E108 | Tunisia | Libya | red dashed | Checked |
| E109 | Egypt | Sudan | red dashed | Checked |
| E110 | Iran | Afghanistan | red dashed | Checked |
| E111 | Iran | Pakistan | red dashed | Checked |
| E112 | Panama | Colombia | red dashed | Checked |

### Superpower

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| E113 | USA | Canada | black | Checked |
| E114 | USA | Mexico | black | Checked |
| E115 | USA | Cuba | black | Checked |
| E116 | USA | Japan | black | Checked |
| E117 | USSR | Finland | black | Checked |
| E118 | USSR | Poland | black | Checked |
| E119 | USSR | Romania | black | Checked |
| E120 | USSR | Afghanistan | black | Checked |
| E121 | USSR | North Korea | black | Checked |

| Edge | Endpoint A | Endpoint B | Printed line | Audit |
|---|---|---|---|---|
| V001 | USSR | Chinese Civil War | black | Checked; optional variant |

## Ambiguities explicitly checked

| Location | Confirmed interpretation |
|---|---|
| East Germany → Austria | The line descends beside West Germany and bends into Austria. It is a direct connection. |
| West Germany / Czechoslovakia | No direct connection; both connect to East Germany. |
| Austria / Czechoslovakia / Yugoslavia | Austria connects to neither Czechoslovakia nor Yugoslavia. |
| France / Benelux | No direct connection. Both connect to UK and West Germany. |
| Romania / Bulgaria | No direct connection. Romania connects to Turkey; Bulgaria connects to Turkey and Greece. |
| Norway / Denmark / Finland | Norway connects only to UK and Sweden. |
| Port./Spain → Italy | The brown line crosses France–Algeria’s dashed line without making a junction. |
| Israel → Syria and Lebanon → Jordan | The two lines cross without making a junction. Israel does not connect directly to Iraq. |
| Syria / Iraq and Iran / USSR | Neither pair has a direct connection. The long black line beside Iran terminates at Afghanistan. |
| Burma / Thailand | No direct connection; Burma connects to India and Laos/Cambodia. |
| Australia → Malaysia | The long diagonal reaches Malaysia. There is no Australia–Indonesia connection. |
| Philippines | Connects only to Japan and Indonesia; not Taiwan or Malaysia. |
| South Korea → Taiwan | The near-vertical line is a direct connection. Japan is also connected to both. |
| Honduras → Costa Rica | Direct connection, in addition to both countries connecting to Nicaragua. |
| Cuba | Connects to USA, Nicaragua, and Haiti; not Mexico. |
| Ethiopia / Kenya | No direct connection; the route passes through Somalia. |
| Angola / Zimbabwe | No direct connection; both connect to Zaire and Botswana. |
| Brazil | Connects only to Venezuela and Uruguay. |
| USA → Japan | Two map-edge arrows represent one undirected connection, counted once. |
| Chinese Civil War | One black link to USSR only; no links to surrounding Asian countries. |

## Machine-readable reference

[twilight-struggle-connectivity.json](../data/reference/twilight-struggle-connectivity.json) contains named nodes, reciprocal neighbor lists, uniquely identified edges with printed-line types, source metadata, audit counts, and the separate optional variant connection.
