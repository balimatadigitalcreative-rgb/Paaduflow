import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, FileText, Package, ShoppingCart, Calculator, Users,
  Grid3x3, Search, Bell, Sparkles, ChevronDown, Check, ArrowUpRight,
  ArrowDownRight, AlertTriangle, Clock, Settings, Sun, Moon, Rows3,
  ArrowRightCircle, X, ArrowUp, ArrowDown, Building2,
} from "lucide-react";

const DATA = {"tenant":{"name":"Nusantara Group","slug":"nusantara"},"user":{"name":"Budi Santoso","ini":"BS","email":"budi@nusantarajaya.co.id","role":"Tenant Owner"},"companies":[{"id":"cmp_njaya","name":"PT Nusantara Jaya","legal":"PT Nusantara Jaya Abadi","ini":"NJ","tax":"01.234.567.8-901.000","cur":"IDR","fyLabel":"FY2026","period":"P8","fyStart":1,"fyRange":"Jan–Des","city":"Surabaya","kpi":{"cash":1842500000,"cashPrev":1735000000,"ar":339753548,"arOver":165999505,"arOverCount":3,"arPrev":292188051,"sales":344724300,"salesPrev":292575475,"gm":26.6,"gmPrev":26.3},"monthly":[{"label":"Sep 2025","rev":218683900,"gm":25.6,"cogs":162672500,"opex":45600000,"revG":213283900,"revS":5400000,"opexMix":[["Gaji & tunjangan",20976000],["Sewa & utilitas",7752000],["Pemasaran",6384000],["Penyusutan",4104000],["Beban operasional lain",6384000]]},{"label":"Okt 2025","rev":242976975,"gm":28.8,"cogs":173030750,"opex":56000000,"revG":226726975,"revS":16250000,"opexMix":[["Gaji & tunjangan",25760000],["Sewa & utilitas",9520000],["Pemasaran",7840000],["Penyusutan",5040000],["Beban operasional lain",7840000]]},{"label":"Nov 2025","rev":272007425,"gm":25.2,"cogs":203495750,"opex":49900000,"revG":269869925,"revS":2137500,"opexMix":[["Gaji & tunjangan",22954000],["Sewa & utilitas",8483000],["Pemasaran",6986000],["Penyusutan",4491000],["Beban operasional lain",6986000]]},{"label":"Des 2025","rev":227393200,"gm":29.5,"cogs":160403500,"opex":47800000,"revG":203393200,"revS":24000000,"opexMix":[["Gaji & tunjangan",21988000],["Sewa & utilitas",8126000],["Pemasaran",6692000],["Penyusutan",4302000],["Beban operasional lain",6692000]]},{"label":"Jan 2026","rev":226596300,"gm":24.0,"cogs":172128250,"opex":52000000,"revG":223591300,"revS":3005000,"opexMix":[["Gaji & tunjangan",23920000],["Sewa & utilitas",8840000],["Pemasaran",7280000],["Penyusutan",4680000],["Beban operasional lain",7280000]]},{"label":"Feb 2026","rev":278567000,"gm":27.9,"cogs":200743000,"opex":52700000,"revG":274067000,"revS":4500000,"opexMix":[["Gaji & tunjangan",24242000],["Sewa & utilitas",8959000],["Pemasaran",7378000],["Penyusutan",4743000],["Beban operasional lain",7378000]]},{"label":"Mar 2026","rev":302549250,"gm":26.9,"cogs":221021250,"opex":57400000,"revG":302099250,"revS":450000,"opexMix":[["Gaji & tunjangan",26404000],["Sewa & utilitas",9758000],["Pemasaran",8036000],["Penyusutan",5166000],["Beban operasional lain",8036000]]},{"label":"Apr 2026","rev":237441550,"gm":25.1,"cogs":177760750,"opex":46300000,"revG":235436050,"revS":2005500,"opexMix":[["Gaji & tunjangan",21298000],["Sewa & utilitas",7871000],["Pemasaran",6482000],["Penyusutan",4167000],["Beban operasional lain",6482000]]},{"label":"Mei 2026","rev":244959100,"gm":28.4,"cogs":175271000,"opex":51500000,"revG":242394100,"revS":2565000,"opexMix":[["Gaji & tunjangan",23690000],["Sewa & utilitas",8755000],["Pemasaran",7210000],["Penyusutan",4635000],["Beban operasional lain",7210000]]},{"label":"Jun 2026","rev":313300300,"gm":27.4,"cogs":227610000,"opex":64800000,"revG":313300300,"revS":0,"opexMix":[["Gaji & tunjangan",29808000],["Sewa & utilitas",11016000],["Pemasaran",9072000],["Penyusutan",5832000],["Beban operasional lain",9072000]]},{"label":"Jul 2026","rev":292575475,"gm":26.3,"cogs":215729750,"opex":52900000,"revG":288975475,"revS":3600000,"opexMix":[["Gaji & tunjangan",24334000],["Sewa & utilitas",8993000],["Pemasaran",7406000],["Penyusutan",4761000],["Beban operasional lain",7406000]]},{"label":"Agu 2026","rev":344724300,"gm":26.6,"cogs":253077000,"opex":69900000,"revG":344724300,"revS":0,"opexMix":[["Gaji & tunjangan",32154000],["Sewa & utilitas",11883000],["Pemasaran",9786000],["Penyusutan",6291000],["Beban operasional lain",9786000]]}],"invoices":[{"no":"INV/2026/08/0003","cust":"Warung Kopi Tugu","issue":"2026-08-26","issueD":"26 Agu 2026","dueD":"25 Sep 2026","due":"2026-09-25","life":"posted","settle":"paid","total":75490545,"out":0,"dpp":68009500,"dg":68009500,"ds":0,"lines":[{"code":"BRG-0031","qty":120,"price":60000,"amount":7200000},{"code":"BRG-0034","qty":703,"price":86500,"amount":60809500}]},{"no":"INV/2026/08/0005","cust":"CV Prima Rasa","issue":"2026-08-18","issueD":"18 Agu 2026","dueD":"17 Sep 2026","due":"2026-09-17","life":"posted","settle":"partially_paid","total":86789568,"out":26598568,"dpp":78188800,"dg":78188800,"ds":0,"lines":[{"code":"BRG-0039","qty":180,"price":57000,"amount":10260000},{"code":"BRG-0033","qty":332,"price":217000,"amount":72044000}]},{"no":"INV/2026/08/0001","cust":"PT Sumber Pangan","issue":"2026-08-09","issueD":"9 Agu 2026","dueD":"8 Sep 2026","due":"2026-09-08","life":"posted","settle":"unpaid","total":74196840,"out":74196840,"dpp":66844000,"dg":66844000,"ds":0,"lines":[{"code":"BRG-0019","qty":12,"price":58000,"amount":696000},{"code":"BRG-0040","qty":1438,"price":46000,"amount":66148000}]},{"no":"INV/2026/08/0004","cust":"CV Karya Mandiri","issue":"2026-08-08","issueD":"8 Agu 2026","dueD":"7 Sep 2026","due":"2026-09-07","life":"posted","settle":"paid","total":73208385,"out":0,"dpp":65953500,"dg":65953500,"ds":0,"lines":[{"code":"BRG-0004","qty":120,"price":42000,"amount":5040000},{"code":"BRG-0009","qty":12,"price":218000,"amount":2616000},{"code":"BRG-0018","qty":180,"price":91500,"amount":16470000},{"code":"BRG-0003","qty":845,"price":49500,"amount":41827500}]},{"no":"INV/2026/08/0008","cust":"CV Prima Rasa","issue":"2026-08-08","issueD":"8 Agu 2026","dueD":"7 Sep 2026","due":"2026-09-07","life":"submitted","settle":"unpaid","total":9110880,"out":9110880,"dpp":8208000,"dg":8208000,"ds":0,"lines":[{"code":"BRG-0039","qty":48,"price":57000,"amount":2736000},{"code":"BRG-0003","qty":24,"price":49500,"amount":1188000},{"code":"BRG-0005","qty":24,"price":178500,"amount":4284000}]},{"no":"INV/2026/08/0007","cust":"Toko Pangan Sejahtera","issue":"2026-08-07","issueD":"7 Agu 2026","dueD":"6 Sep 2026","due":"2026-09-06","life":"pending_approval","settle":"unpaid","total":16703280,"out":16703280,"dpp":15048000,"dg":15048000,"ds":0,"lines":[{"code":"BRG-0030","qty":48,"price":86500,"amount":4152000},{"code":"BRG-0017","qty":48,"price":207000,"amount":9936000},{"code":"BRG-0028","qty":24,"price":40000,"amount":960000}]},{"no":"INV/2026/08/0006","cust":"PT Citra Boga","issue":"2026-08-06","issueD":"6 Agu 2026","dueD":"5 Sep 2026","due":"2026-09-05","life":"draft","settle":"unpaid","total":23596380,"out":23596380,"dpp":21258000,"dg":21258000,"ds":0,"lines":[{"code":"BRG-0017","qty":24,"price":207000,"amount":4968000},{"code":"BRG-0004","qty":180,"price":42000,"amount":7560000},{"code":"BRG-0036","qty":180,"price":48500,"amount":8730000}]},{"no":"INV/2026/08/0002","cust":"Toko Pangan Sejahtera","issue":"2026-08-03","issueD":"3 Agu 2026","dueD":"2 Sep 2026","due":"2026-09-02","life":"posted","settle":"unpaid","total":72958635,"out":72958635,"dpp":65728500,"dg":65728500,"ds":0,"lines":[{"code":"BRG-0007","qty":48,"price":57500,"amount":2760000},{"code":"BRG-0020","qty":24,"price":49000,"amount":1176000},{"code":"BRG-0025","qty":321,"price":192500,"amount":61792500}]},{"no":"INV/2026/07/0001","cust":"Toko Sinar Abadi","issue":"2026-07-25","issueD":"25 Jul 2026","dueD":"8 Agu 2026","due":"2026-08-08","life":"posted","settle":"paid","total":83283300,"out":0,"dpp":75030000,"dg":75030000,"ds":0,"lines":[{"code":"BRG-0004","qty":180,"price":42000,"amount":7560000},{"code":"BRG-0034","qty":780,"price":86500,"amount":67470000}]},{"no":"INV/2026/07/0004","cust":"PT Boga Utama","issue":"2026-07-25","issueD":"25 Jul 2026","dueD":"24 Agu 2026","due":"2026-08-24","life":"posted","settle":"paid","total":73488105,"out":0,"dpp":66205500,"dg":66205500,"ds":0,"lines":[{"code":"BRG-0033","qty":180,"price":217000,"amount":39060000},{"code":"BRG-0031","qty":12,"price":60000,"amount":720000},{"code":"BRG-0016","qty":669,"price":39500,"amount":26425500}]},{"no":"INV/2026/07/0003","cust":"CV Sejahtera Mulia","issue":"2026-07-22","issueD":"22 Jul 2026","dueD":"21 Agu 2026","due":"2026-08-21","life":"posted","settle":"paid","total":12574080,"out":0,"dpp":11328000,"dg":10428000,"ds":900000,"lines":[{"code":"BRG-0019","qty":12,"price":58000,"amount":696000},{"code":"BRG-0023","qty":120,"price":47000,"amount":5640000},{"code":"BRG-0021","qty":24,"price":170500,"amount":4092000},{"code":"JSA-0041","qty":2,"price":450000,"amount":900000}]},{"no":"INV/2026/07/0002","cust":"Toko Berkah Jaya","issue":"2026-07-06","issueD":"6 Jul 2026","dueD":"5 Agu 2026","due":"2026-08-05","life":"posted","settle":"unpaid","total":82262100,"out":82262100,"dpp":74110000,"dg":71410000,"ds":2700000,"lines":[{"code":"BRG-0003","qty":12,"price":49500,"amount":594000},{"code":"JSA-0041","qty":6,"price":450000,"amount":2700000},{"code":"BRG-0007","qty":180,"price":57500,"amount":10350000},{"code":"BRG-0020","qty":1234,"price":49000,"amount":60466000}]},{"no":"INV/2026/07/0005","cust":"PT Sumber Pangan","issue":"2026-07-06","issueD":"6 Jul 2026","dueD":"5 Agu 2026","due":"2026-08-05","life":"posted","settle":"partially_paid","total":73151192,"out":40989192,"dpp":65901975,"dg":65901975,"ds":0,"lines":[{"code":"BRG-0039","qty":12,"price":57000,"amount":684000},{"code":"BRG-0024","qty":1579,"price":43500,"amount":68686500}]},{"no":"INV/2026/06/0001","cust":"Kopi Kita","issue":"2026-06-14","issueD":"14 Jun 2026","dueD":"14 Jul 2026","due":"2026-07-14","life":"posted","settle":"paid","total":81403515,"out":0,"dpp":73336500,"dg":73336500,"ds":0},{"no":"INV/2026/06/0003","cust":"CV Mandiri Sentosa","issue":"2026-06-09","issueD":"9 Jun 2026","dueD":"9 Jul 2026","due":"2026-07-09","life":"posted","settle":"paid","total":74187960,"out":0,"dpp":66836000,"dg":66836000,"ds":0},{"no":"INV/2026/06/0004","cust":"CV Prima Rasa","issue":"2026-06-04","issueD":"4 Jun 2026","dueD":"4 Jul 2026","due":"2026-07-04","life":"posted","settle":"partially_paid","total":63390213,"out":42748213,"dpp":57108300,"dg":57108300,"ds":0},{"no":"INV/2026/06/0002","cust":"CV Bintang Timur","issue":"2026-06-03","issueD":"3 Jun 2026","dueD":"18 Jul 2026","due":"2026-07-18","life":"posted","settle":"paid","total":61738755,"out":0,"dpp":55620500,"dg":55620500,"ds":0},{"no":"INV/2026/06/0005","cust":"CV Karya Mandiri","issue":"2026-06-02","issueD":"2 Jun 2026","dueD":"2 Jul 2026","due":"2026-07-02","life":"posted","settle":"paid","total":67042890,"out":0,"dpp":60399000,"dg":60399000,"ds":0},{"no":"INV/2026/05/0001","cust":"Toko Harapan Jaya","issue":"2026-05-23","issueD":"23 Mei 2026","dueD":"6 Jun 2026","due":"2026-06-06","life":"posted","settle":"paid","total":72632295,"out":0,"dpp":65434500,"dg":65434500,"ds":0},{"no":"INV/2026/05/0005","cust":"PT Sumber Pangan","issue":"2026-05-20","issueD":"20 Mei 2026","dueD":"19 Jun 2026","due":"2026-06-19","life":"posted","settle":"paid","total":71113260,"out":0,"dpp":64066000,"dg":64066000,"ds":0},{"no":"INV/2026/05/0002","cust":"Warung Kopi Tugu","issue":"2026-05-13","issueD":"13 Mei 2026","dueD":"12 Jun 2026","due":"2026-06-12","life":"posted","settle":"paid","total":65561040,"out":0,"dpp":59064000,"dg":59064000,"ds":0},{"no":"INV/2026/05/0003","cust":"PT Boga Utama","issue":"2026-05-12","issueD":"12 Mei 2026","dueD":"11 Jun 2026","due":"2026-06-11","life":"posted","settle":"paid","total":57549060,"out":0,"dpp":51846000,"dg":51846000,"ds":0},{"no":"INV/2026/05/0004","cust":"Toko Harapan Jaya","issue":"2026-05-07","issueD":"7 Mei 2026","dueD":"21 Mei 2026","due":"2026-05-21","life":"posted","settle":"paid","total":5048946,"out":0,"dpp":4548600,"dg":1983600,"ds":2565000},{"no":"INV/2026/04/0002","cust":"CV Prima Rasa","issue":"2026-04-25","issueD":"25 Apr 2026","dueD":"25 Mei 2026","due":"2026-05-25","life":"posted","settle":"paid","total":67689410,"out":0,"dpp":60981450,"dg":60981450,"ds":0},{"no":"INV/2026/04/0001","cust":"CV Karya Mandiri","issue":"2026-04-21","issueD":"21 Apr 2026","dueD":"21 Mei 2026","due":"2026-05-21","life":"posted","settle":"paid","total":4011318,"out":0,"dpp":3613800,"dg":2958300,"ds":655500},{"no":"INV/2026/04/0003","cust":"CV Karya Mandiri","issue":"2026-04-20","issueD":"20 Apr 2026","dueD":"20 Mei 2026","due":"2026-05-20","life":"posted","settle":"paid","total":65345700,"out":0,"dpp":58870000,"dg":58870000,"ds":0},{"no":"INV/2026/04/0005","cust":"Toko Pangan Sejahtera","issue":"2026-04-06","issueD":"6 Apr 2026","dueD":"6 Mei 2026","due":"2026-05-06","life":"posted","settle":"paid","total":63769833,"out":0,"dpp":57450300,"dg":57450300,"ds":0},{"no":"INV/2026/04/0004","cust":"CV Bintang Timur","issue":"2026-04-04","issueD":"4 Apr 2026","dueD":"19 Mei 2026","due":"2026-05-19","life":"posted","settle":"paid","total":62743860,"out":0,"dpp":56526000,"dg":55176000,"ds":1350000},{"no":"INV/2026/03/0001","cust":"PT Boga Utama","issue":"2026-03-21","issueD":"21 Mar 2026","dueD":"20 Apr 2026","due":"2026-04-20","life":"posted","settle":"paid","total":64005375,"out":0,"dpp":57662500,"dg":57212500,"ds":450000},{"no":"INV/2026/03/0002","cust":"PT Citra Boga","issue":"2026-03-16","issueD":"16 Mar 2026","dueD":"15 Apr 2026","due":"2026-04-15","life":"posted","settle":"paid","total":77855400,"out":0,"dpp":70140000,"dg":70140000,"ds":0},{"no":"INV/2026/03/0003","cust":"Toko Amanah","issue":"2026-03-10","issueD":"10 Mar 2026","dueD":"9 Apr 2026","due":"2026-04-09","life":"posted","settle":"paid","total":70165320,"out":0,"dpp":63212000,"dg":63212000,"ds":0},{"no":"INV/2026/03/0005","cust":"PT Sumber Pangan","issue":"2026-03-10","issueD":"10 Mar 2026","dueD":"9 Apr 2026","due":"2026-04-09","life":"posted","settle":"paid","total":58315959,"out":0,"dpp":52536900,"dg":52536900,"ds":0},{"no":"INV/2026/03/0004","cust":"Kopi Kita","issue":"2026-03-08","issueD":"8 Mar 2026","dueD":"7 Apr 2026","due":"2026-04-07","life":"posted","settle":"paid","total":65487614,"out":0,"dpp":58997850,"dg":58997850,"ds":0},{"no":"INV/2026/02/0002","cust":"Toko Berkah Jaya","issue":"2026-02-13","issueD":"13 Feb 2026","dueD":"15 Mar 2026","due":"2026-03-15","life":"posted","settle":"paid","total":56310300,"out":0,"dpp":50730000,"dg":50730000,"ds":0},{"no":"INV/2026/02/0004","cust":"CV Karya Mandiri","issue":"2026-02-09","issueD":"9 Feb 2026","dueD":"11 Mar 2026","due":"2026-03-11","life":"posted","settle":"paid","total":65829660,"out":0,"dpp":59306000,"dg":54806000,"ds":4500000},{"no":"INV/2026/02/0003","cust":"CV Bintang Timur","issue":"2026-02-05","issueD":"5 Feb 2026","dueD":"22 Mar 2026","due":"2026-03-22","life":"posted","settle":"paid","total":58966530,"out":0,"dpp":53123000,"dg":53123000,"ds":0},{"no":"INV/2026/02/0001","cust":"PT Citra Boga","issue":"2026-02-02","issueD":"2 Feb 2026","dueD":"4 Mar 2026","due":"2026-03-04","life":"posted","settle":"paid","total":64047000,"out":0,"dpp":57700000,"dg":57700000,"ds":0},{"no":"INV/2026/02/0005","cust":"CV Sejahtera Mulia","issue":"2026-02-02","issueD":"2 Feb 2026","dueD":"4 Mar 2026","due":"2026-03-04","life":"posted","settle":"paid","total":64055880,"out":0,"dpp":57708000,"dg":57708000,"ds":0},{"no":"INV/2026/01/0002","cust":"PT Rasa Bumi","issue":"2026-01-23","issueD":"23 Jan 2026","dueD":"6 Feb 2026","due":"2026-02-06","life":"posted","settle":"paid","total":55516262,"out":0,"dpp":50014650,"dg":49159650,"ds":855000},{"no":"INV/2026/01/0005","cust":"Kedai Kopi Merdeka","issue":"2026-01-17","issueD":"17 Jan 2026","dueD":"31 Jan 2026","due":"2026-01-31","life":"posted","settle":"paid","total":57743366,"out":0,"dpp":52021050,"dg":52021050,"ds":0},{"no":"INV/2026/01/0003","cust":"Toko Berkah Jaya","issue":"2026-01-11","issueD":"11 Jan 2026","dueD":"10 Feb 2026","due":"2026-02-10","life":"posted","settle":"paid","total":17897640,"out":0,"dpp":16124000,"dg":14874000,"ds":1250000},{"no":"INV/2026/01/0004","cust":"Toko Harapan Jaya","issue":"2026-01-06","issueD":"6 Jan 2026","dueD":"20 Jan 2026","due":"2026-01-20","life":"posted","settle":"paid","total":59258460,"out":0,"dpp":53386000,"dg":52486000,"ds":900000},{"no":"INV/2026/01/0001","cust":"Warung Mbak Yuni","issue":"2026-01-05","issueD":"5 Jan 2026","dueD":"4 Feb 2026","due":"2026-02-04","life":"posted","settle":"paid","total":61106166,"out":0,"dpp":55050600,"dg":55050600,"ds":0},{"no":"INV/2025/12/0002","cust":"CV Bintang Timur","issue":"2025-12-22","issueD":"22 Des 2025","dueD":"5 Feb 2026","due":"2026-02-05","life":"posted","settle":"paid","total":66786480,"out":0,"dpp":60168000,"dg":60168000,"ds":0},{"no":"INV/2025/12/0001","cust":"Kafe Senja","issue":"2025-12-18","issueD":"18 Des 2025","dueD":"17 Jan 2026","due":"2026-01-17","life":"posted","settle":"paid","total":61571700,"out":0,"dpp":55470000,"dg":55470000,"ds":0},{"no":"INV/2025/12/0003","cust":"Toko Harapan Jaya","issue":"2025-12-03","issueD":"3 Des 2025","dueD":"17 Des 2025","due":"2025-12-17","life":"posted","settle":"paid","total":59406312,"out":0,"dpp":53519200,"dg":53519200,"ds":0},{"no":"INV/2025/12/0004","cust":"Toko Sinar Abadi","issue":"2025-12-03","issueD":"3 Des 2025","dueD":"17 Des 2025","due":"2025-12-17","life":"posted","settle":"paid","total":31561740,"out":0,"dpp":28434000,"dg":20934000,"ds":7500000},{"no":"INV/2025/12/0005","cust":"CV Prima Rasa","issue":"2025-12-02","issueD":"2 Des 2025","dueD":"1 Jan 2026","due":"2026-01-01","life":"posted","settle":"paid","total":33080220,"out":0,"dpp":29802000,"dg":13302000,"ds":16500000},{"no":"INV/2025/11/0005","cust":"Toko Harapan Jaya","issue":"2025-11-24","issueD":"24 Nov 2025","dueD":"8 Des 2025","due":"2025-12-08","life":"posted","settle":"paid","total":61412970,"out":0,"dpp":55327000,"dg":55327000,"ds":0},{"no":"INV/2025/11/0002","cust":"CV Mandiri Sentosa","issue":"2025-11-15","issueD":"15 Nov 2025","dueD":"15 Des 2025","due":"2025-12-15","life":"posted","settle":"paid","total":67796441,"out":0,"dpp":61077875,"dg":58940375,"ds":2137500},{"no":"INV/2025/11/0003","cust":"PT Sumber Pangan","issue":"2025-11-12","issueD":"12 Nov 2025","dueD":"12 Des 2025","due":"2025-12-12","life":"posted","settle":"paid","total":49297875,"out":0,"dpp":44412500,"dg":44412500,"ds":0},{"no":"INV/2025/11/0004","cust":"PT Citra Boga","issue":"2025-11-12","issueD":"12 Nov 2025","dueD":"12 Des 2025","due":"2025-12-12","life":"posted","settle":"paid","total":67354245,"out":0,"dpp":60679500,"dg":60679500,"ds":0},{"no":"INV/2025/11/0001","cust":"Kafe Senja","issue":"2025-11-06","issueD":"6 Nov 2025","dueD":"6 Des 2025","due":"2025-12-06","life":"posted","settle":"paid","total":56066710,"out":0,"dpp":50510550,"dg":50510550,"ds":0},{"no":"INV/2025/10/0002","cust":"CV Mandiri Sentosa","issue":"2025-10-25","issueD":"25 Okt 2025","dueD":"24 Nov 2025","due":"2025-11-24","life":"posted","settle":"paid","total":53309970,"out":0,"dpp":48027000,"dg":33027000,"ds":15000000},{"no":"INV/2025/10/0004","cust":"CV Mandiri Sentosa","issue":"2025-10-18","issueD":"18 Okt 2025","dueD":"17 Nov 2025","due":"2025-11-17","life":"posted","settle":"paid","total":58969222,"out":0,"dpp":53125425,"dg":53125425,"ds":0},{"no":"INV/2025/10/0001","cust":"Warung Sedap","issue":"2025-10-12","issueD":"12 Okt 2025","dueD":"11 Nov 2025","due":"2025-11-11","life":"posted","settle":"paid","total":48273900,"out":0,"dpp":43490000,"dg":42240000,"ds":1250000},{"no":"INV/2025/10/0003","cust":"Warung Mbak Yuni","issue":"2025-10-11","issueD":"11 Okt 2025","dueD":"10 Nov 2025","due":"2025-11-10","life":"posted","settle":"paid","total":52177770,"out":0,"dpp":47007000,"dg":47007000,"ds":0},{"no":"INV/2025/10/0005","cust":"PT Citra Boga","issue":"2025-10-10","issueD":"10 Okt 2025","dueD":"9 Nov 2025","due":"2025-11-09","life":"posted","settle":"paid","total":56973580,"out":0,"dpp":51327550,"dg":51327550,"ds":0},{"no":"INV/2025/09/0002","cust":"Toko Amanah","issue":"2025-09-25","issueD":"25 Sep 2025","dueD":"25 Okt 2025","due":"2025-10-25","life":"posted","settle":"paid","total":52974195,"out":0,"dpp":47724500,"dg":47724500,"ds":0},{"no":"INV/2025/09/0004","cust":"Toko Harapan Jaya","issue":"2025-09-18","issueD":"18 Sep 2025","dueD":"2 Okt 2025","due":"2025-10-02","life":"posted","settle":"paid","total":39875640,"out":0,"dpp":35924000,"dg":35924000,"ds":0},{"no":"INV/2025/09/0003","cust":"Toko Pangan Sejahtera","issue":"2025-09-12","issueD":"12 Sep 2025","dueD":"12 Okt 2025","due":"2025-10-12","life":"posted","settle":"paid","total":47812140,"out":0,"dpp":43074000,"dg":43074000,"ds":0},{"no":"INV/2025/09/0005","cust":"PT Boga Utama","issue":"2025-09-08","issueD":"8 Sep 2025","dueD":"8 Okt 2025","due":"2025-10-08","life":"posted","settle":"paid","total":51733215,"out":0,"dpp":46606500,"dg":41206500,"ds":5400000},{"no":"INV/2025/09/0001","cust":"Warung Kopi Tugu","issue":"2025-09-02","issueD":"2 Sep 2025","dueD":"2 Okt 2025","due":"2025-10-02","life":"posted","settle":"paid","total":50343939,"out":0,"dpp":45354900,"dg":45354900,"ds":0}],"items":[{"c":"BRG-0001","n":"Kopi Arabika Gayo 1 kg","p":176500,"u":"PCS"},{"c":"BRG-0002","n":"Kopi Arabika Gayo 500 g","p":91500,"u":"PCS"},{"c":"BRG-0003","n":"Kopi Arabika Gayo 250 g","p":49500,"u":"PCS"},{"c":"BRG-0004","n":"Kopi Arabika Gayo 200 g","p":42000,"u":"PCS"},{"c":"BRG-0005","n":"Kopi Robusta Lampung 1 kg","p":178500,"u":"PCS"},{"c":"BRG-0006","n":"Kopi Robusta Lampung 500 g","p":91500,"u":"PCS"},{"c":"BRG-0007","n":"Kopi Robusta Lampung 250 g","p":57500,"u":"PCS"},{"c":"BRG-0008","n":"Kopi Robusta Lampung 200 g","p":44000,"u":"PCS"},{"c":"BRG-0009","n":"Kopi Arabika Kintamani 1 kg","p":218000,"u":"PCS"},{"c":"BRG-0010","n":"Kopi Arabika Kintamani 500 g","p":111000,"u":"PCS"},{"c":"BRG-0011","n":"Kopi Arabika Kintamani 250 g","p":53500,"u":"PCS"},{"c":"BRG-0012","n":"Kopi Arabika Kintamani 200 g","p":41500,"u":"PCS"},{"c":"BRG-0013","n":"Kopi Arabika Toraja 1 kg","p":183500,"u":"PCS"},{"c":"BRG-0014","n":"Kopi Arabika Toraja 500 g","p":112500,"u":"PCS"},{"c":"BRG-0015","n":"Kopi Arabika Toraja 250 g","p":48000,"u":"PCS"},{"c":"BRG-0016","n":"Kopi Arabika Toraja 200 g","p":39500,"u":"PCS"},{"c":"BRG-0017","n":"Kopi Arabika Flores 1 kg","p":207000,"u":"PCS"},{"c":"BRG-0018","n":"Kopi Arabika Flores 500 g","p":91500,"u":"PCS"},{"c":"BRG-0019","n":"Kopi Arabika Flores 250 g","p":58000,"u":"PCS"},{"c":"BRG-0020","n":"Kopi Arabika Flores 200 g","p":49000,"u":"PCS"},{"c":"BRG-0021","n":"Kopi Robusta Temanggung 1 kg","p":170500,"u":"PCS"},{"c":"BRG-0022","n":"Kopi Robusta Temanggung 500 g","p":114000,"u":"PCS"},{"c":"BRG-0023","n":"Kopi Robusta Temanggung 250 g","p":47000,"u":"PCS"},{"c":"BRG-0024","n":"Kopi Robusta Temanggung 200 g","p":43500,"u":"PCS"},{"c":"BRG-0025","n":"Kopi Arabika Java Preanger 1 kg","p":192500,"u":"PCS"},{"c":"BRG-0026","n":"Kopi Arabika Java Preanger 500 g","p":89000,"u":"PCS"},{"c":"BRG-0027","n":"Kopi Arabika Java Preanger 250 g","p":50000,"u":"PCS"},{"c":"BRG-0028","n":"Kopi Arabika Java Preanger 200 g","p":40000,"u":"PCS"},{"c":"BRG-0029","n":"Kopi Arabika Wamena 1 kg","p":179500,"u":"PCS"},{"c":"BRG-0030","n":"Kopi Arabika Wamena 500 g","p":86500,"u":"PCS"},{"c":"BRG-0031","n":"Kopi Arabika Wamena 250 g","p":60000,"u":"PCS"},{"c":"BRG-0032","n":"Kopi Arabika Wamena 200 g","p":44500,"u":"PCS"},{"c":"BRG-0033","n":"Kopi Arabika Mandheling 1 kg","p":217000,"u":"PCS"},{"c":"BRG-0034","n":"Kopi Arabika Mandheling 500 g","p":86500,"u":"PCS"},{"c":"BRG-0035","n":"Kopi Arabika Mandheling 250 g","p":59500,"u":"PCS"},{"c":"BRG-0036","n":"Kopi Arabika Mandheling 200 g","p":48500,"u":"PCS"},{"c":"BRG-0037","n":"Kopi Robusta Bengkulu 1 kg","p":164000,"u":"PCS"},{"c":"BRG-0038","n":"Kopi Robusta Bengkulu 500 g","p":99500,"u":"PCS"},{"c":"BRG-0039","n":"Kopi Robusta Bengkulu 250 g","p":57000,"u":"PCS"},{"c":"BRG-0040","n":"Kopi Robusta Bengkulu 200 g","p":46000,"u":"PCS"},{"c":"JSA-0041","n":"Jasa roasting custom","p":450000,"u":"UNIT"},{"c":"JSA-0042","n":"Jasa grinding","p":120000,"u":"UNIT"},{"c":"JSA-0043","n":"Biaya pengiriman","p":1250000,"u":"UNIT"},{"c":"JSA-0044","n":"Jasa cupping & QC","p":750000,"u":"UNIT"}],"customers":[{"n":"Kopi Kita","t":30},{"n":"Warung Sedap","t":30},{"n":"Toko Berkah Jaya","t":30},{"n":"CV Mandiri Sentosa","t":30},{"n":"Kedai Nusantara","t":30},{"n":"PT Rasa Bumi","t":14},{"n":"Toko Sinar Abadi","t":14},{"n":"CV Karya Mandiri","t":30},{"n":"Warung Bu Tini","t":30},{"n":"PT Boga Utama","t":30},{"n":"Kafe Senja","t":30},{"n":"Toko Pangan Sejahtera","t":30},{"n":"CV Anugerah Rasa","t":30},{"n":"PT Sumber Pangan","t":30},{"n":"Warung Kopi Tugu","t":30},{"n":"Toko Rejeki Baru","t":30},{"n":"CV Bintang Timur","t":45},{"n":"PT Citra Boga","t":30},{"n":"Kedai Kopi Merdeka","t":14},{"n":"Toko Amanah","t":30},{"n":"CV Sejahtera Mulia","t":30},{"n":"PT Delta Pangan","t":30},{"n":"Warung Mbak Yuni","t":30},{"n":"Toko Harapan Jaya","t":14},{"n":"CV Prima Rasa","t":30}],"aging":{"current":{"count":3,"amount":173754043},"d1_30":{"count":2,"amount":123251292},"d31_60":{"count":1,"amount":42748213},"d60_plus":{"count":0,"amount":0}},"activity":[{"who":"Budi Santoso","ini":"BS","kind":"human","text":"menerbitkan INV/2026/08/0004","ago":"10 menit lalu"},{"who":"Asisten","ini":"AI","kind":"ai","text":"menandai kenaikan harga beli Kopi Arabika Gayo 18%","ago":"1 jam lalu"},{"who":"Sistem","ini":"SY","kind":"system","text":"memposting jurnal penyusutan Agustus","ago":"3 jam lalu"},{"who":"Sari Wijaya","ini":"SW","kind":"human","text":"menyetujui PO/2026/08/0003","ago":"kemarin"}]},{"id":"cmp_nlog","name":"PT Nusantara Logistik","legal":"PT Nusantara Logistik Prima","ini":"NL","tax":"02.876.543.2-109.000","cur":"IDR","fyLabel":"FY2026/27","period":"P5","fyStart":4,"fyRange":"Apr–Mar","city":"Surabaya","kpi":{"cash":486300000,"cashPrev":512800000,"ar":183982500,"arOver":78144000,"arOverCount":2,"arPrev":217099350,"sales":147000000,"salesPrev":132000000,"gm":32.5,"gmPrev":36.2},"monthly":[{"label":"Sep 2025","rev":88000000,"gm":37.0,"cogs":55440000,"opex":29752717,"revG":0,"revS":88000000,"opexMix":[["Gaji & tunjangan",12198614],["Bahan bakar & tol",6843125],["Sewa & utilitas",4462908],["Penyusutan armada",3570326],["Beban operasional lain",2677745]]},{"label":"Okt 2025","rev":94000000,"gm":37.7,"cogs":58562000,"opex":32300310,"revG":0,"revS":94000000,"opexMix":[["Gaji & tunjangan",13243127],["Bahan bakar & tol",7429071],["Sewa & utilitas",4845046],["Penyusutan armada",3876037],["Beban operasional lain",2907028]]},{"label":"Nov 2025","rev":101000000,"gm":37.6,"cogs":63024000,"opex":30252858,"revG":0,"revS":101000000,"opexMix":[["Gaji & tunjangan",12403672],["Bahan bakar & tol",6958157],["Sewa & utilitas",4537929],["Penyusutan armada",3630343],["Beban operasional lain",2722757]]},{"label":"Des 2025","rev":97000000,"gm":33.5,"cogs":64505000,"opex":33899233,"revG":0,"revS":97000000,"opexMix":[["Gaji & tunjangan",13898686],["Bahan bakar & tol",7796824],["Sewa & utilitas",5084885],["Penyusutan armada",4067908],["Beban operasional lain",3050931]]},{"label":"Jan 2026","rev":86000000,"gm":37.7,"cogs":53578000,"opex":31148215,"revG":0,"revS":86000000,"opexMix":[["Gaji & tunjangan",12770768],["Bahan bakar & tol",7164089],["Sewa & utilitas",4672232],["Penyusutan armada",3737786],["Beban operasional lain",2803339]]},{"label":"Feb 2026","rev":92000000,"gm":33.1,"cogs":61548000,"opex":29577519,"revG":0,"revS":92000000,"opexMix":[["Gaji & tunjangan",12126783],["Bahan bakar & tol",6802829],["Sewa & utilitas",4436628],["Penyusutan armada",3549302],["Beban operasional lain",2661977]]},{"label":"Mar 2026","rev":108000000,"gm":37.8,"cogs":67176000,"opex":32784785,"revG":0,"revS":108000000,"opexMix":[["Gaji & tunjangan",13441762],["Bahan bakar & tol",7540501],["Sewa & utilitas",4917718],["Penyusutan armada",3934174],["Beban operasional lain",2950631]]},{"label":"Apr 2026","rev":115000000,"gm":33.3,"cogs":76705000,"opex":37587545,"revG":0,"revS":115000000,"opexMix":[["Gaji & tunjangan",15410893],["Bahan bakar & tol",8645135],["Sewa & utilitas",5638132],["Penyusutan armada",4510505],["Beban operasional lain",3382879]]},{"label":"Mei 2026","rev":121000000,"gm":33.4,"cogs":80586000,"opex":37767364,"revG":0,"revS":121000000,"opexMix":[["Gaji & tunjangan",15484619],["Bahan bakar & tol",8686494],["Sewa & utilitas",5665105],["Penyusutan armada",4532084],["Beban operasional lain",3399063]]},{"label":"Jun 2026","rev":118000000,"gm":36.4,"cogs":75048000,"opex":33637774,"revG":0,"revS":118000000,"opexMix":[["Gaji & tunjangan",13791487],["Bahan bakar & tol",7736688],["Sewa & utilitas",5045666],["Penyusutan armada",4036533],["Beban operasional lain",3027400]]},{"label":"Jul 2026","rev":132000000,"gm":36.2,"cogs":84216000,"opex":35856145,"revG":0,"revS":132000000,"opexMix":[["Gaji & tunjangan",14701019],["Bahan bakar & tol",8246913],["Sewa & utilitas",5378422],["Penyusutan armada",4302737],["Beban operasional lain",3227053]]},{"label":"Agu 2026","rev":147000000,"gm":32.5,"cogs":99225000,"opex":40145235,"revG":0,"revS":147000000,"opexMix":[["Gaji & tunjangan",16459546],["Bahan bakar & tol",9233404],["Sewa & utilitas",6021785],["Penyusutan armada",4817428],["Beban operasional lain",3613071]]}],"invoices":[{"no":"INV/2026/08/0001","cust":"CV Trans Jaya","issue":"2026-08-19","issueD":"19 Agu 2026","due":"2026-09-18","dueD":"18 Sep 2026","life":"posted","settle":"paid","total":60994500,"out":0,"dpp":54950000,"dg":0,"ds":54950000},{"no":"INV/2026/08/0003","cust":"CV Trans Jaya","issue":"2026-08-09","issueD":"9 Agu 2026","due":"2026-09-08","dueD":"8 Sep 2026","life":"posted","settle":"unpaid","total":57387000,"out":57387000,"dpp":51700000,"dg":0,"ds":51700000},{"no":"INV/2026/08/0004","cust":"PT Mitra Distribusi","issue":"2026-08-08","issueD":"8 Agu 2026","due":"2026-09-07","dueD":"7 Sep 2026","life":"pending_approval","settle":"unpaid","total":39405000,"out":39405000,"dpp":35500000,"dg":0,"ds":35500000},{"no":"INV/2026/08/0002","cust":"PT Citra Boga","issue":"2026-08-02","issueD":"2 Agu 2026","due":"2026-09-01","dueD":"1 Sep 2026","life":"posted","settle":"paid","total":44788500,"out":0,"dpp":40350000,"dg":0,"ds":40350000},{"no":"INV/2026/07/0002","cust":"Toko Berkah Jaya","issue":"2026-07-19","issueD":"19 Jul 2026","due":"2026-08-18","dueD":"18 Agu 2026","life":"posted","settle":"unpaid","total":48451500,"out":48451500,"dpp":43650000,"dg":0,"ds":43650000},{"no":"INV/2026/07/0003","cust":"PT Citra Boga","issue":"2026-07-12","issueD":"12 Jul 2026","due":"2026-07-26","dueD":"26 Jul 2026","life":"posted","settle":"unpaid","total":55888500,"out":55888500,"dpp":50350000,"dg":0,"ds":50350000},{"no":"INV/2026/07/0001","cust":"PT Mitra Distribusi","issue":"2026-07-04","issueD":"4 Jul 2026","due":"2026-07-18","dueD":"18 Jul 2026","life":"posted","settle":"paid","total":42180000,"out":0,"dpp":38000000,"dg":0,"ds":38000000},{"no":"INV/2026/06/0002","cust":"CV Trans Jaya","issue":"2026-06-25","issueD":"25 Jun 2026","due":"2026-07-25","dueD":"25 Jul 2026","life":"posted","settle":"paid","total":37684500,"out":0,"dpp":33950000,"dg":0,"ds":33950000},{"no":"INV/2026/06/0003","cust":"PT Mitra Distribusi","issue":"2026-06-18","issueD":"18 Jun 2026","due":"2026-07-02","dueD":"2 Jul 2026","life":"posted","settle":"paid","total":48784500,"out":0,"dpp":43950000,"dg":0,"ds":43950000},{"no":"INV/2026/06/0001","cust":"Toko Berkah Jaya","issue":"2026-06-10","issueD":"10 Jun 2026","due":"2026-07-10","dueD":"10 Jul 2026","life":"posted","settle":"partially_paid","total":44511000,"out":22255500,"dpp":40100000,"dg":0,"ds":40100000},{"no":"INV/2026/05/0002","cust":"PT Citra Boga","issue":"2026-05-21","issueD":"21 Mei 2026","due":"2026-06-20","dueD":"20 Jun 2026","life":"posted","settle":"paid","total":47674500,"out":0,"dpp":42950000,"dg":0,"ds":42950000},{"no":"INV/2026/05/0001","cust":"PT Citra Boga","issue":"2026-05-04","issueD":"4 Mei 2026","due":"2026-06-03","dueD":"3 Jun 2026","life":"posted","settle":"paid","total":42457500,"out":0,"dpp":38250000,"dg":0,"ds":38250000},{"no":"INV/2026/05/0003","cust":"PT Citra Boga","issue":"2026-05-04","issueD":"4 Mei 2026","due":"2026-06-03","dueD":"3 Jun 2026","life":"posted","settle":"paid","total":44178000,"out":0,"dpp":39800000,"dg":0,"ds":39800000},{"no":"INV/2026/04/0001","cust":"Toko Berkah Jaya","issue":"2026-04-25","issueD":"25 Apr 2026","due":"2026-05-25","dueD":"25 Mei 2026","life":"posted","settle":"paid","total":37018500,"out":0,"dpp":33350000,"dg":0,"ds":33350000},{"no":"INV/2026/04/0003","cust":"PT Sinar Cargo","issue":"2026-04-09","issueD":"9 Apr 2026","due":"2026-04-23","dueD":"23 Apr 2026","life":"posted","settle":"paid","total":50116500,"out":0,"dpp":45150000,"dg":0,"ds":45150000},{"no":"INV/2026/04/0002","cust":"PT Sinar Cargo","issue":"2026-04-05","issueD":"5 Apr 2026","due":"2026-04-19","dueD":"19 Apr 2026","life":"posted","settle":"paid","total":40515000,"out":0,"dpp":36500000,"dg":0,"ds":36500000},{"no":"INV/2026/03/0001","cust":"PT Mitra Distribusi","issue":"2026-03-10","issueD":"10 Mar 2026","due":"2026-04-09","dueD":"9 Apr 2026","life":"posted","settle":"paid","total":38073000,"out":0,"dpp":34300000,"dg":0,"ds":34300000},{"no":"INV/2026/03/0002","cust":"PT Mitra Distribusi","issue":"2026-03-07","issueD":"7 Mar 2026","due":"2026-04-06","dueD":"6 Apr 2026","life":"posted","settle":"paid","total":41958000,"out":0,"dpp":37800000,"dg":0,"ds":37800000},{"no":"INV/2026/03/0003","cust":"PT Mitra Distribusi","issue":"2026-03-05","issueD":"5 Mar 2026","due":"2026-04-04","dueD":"4 Apr 2026","life":"posted","settle":"paid","total":39849000,"out":0,"dpp":35900000,"dg":0,"ds":35900000},{"no":"INV/2026/02/0001","cust":"PT Mitra Distribusi","issue":"2026-02-25","issueD":"25 Feb 2026","due":"2026-03-11","dueD":"11 Mar 2026","life":"posted","settle":"paid","total":30913500,"out":0,"dpp":27850000,"dg":0,"ds":27850000},{"no":"INV/2026/02/0003","cust":"Toko Berkah Jaya","issue":"2026-02-22","issueD":"22 Feb 2026","due":"2026-03-24","dueD":"24 Mar 2026","life":"posted","settle":"paid","total":38184000,"out":0,"dpp":34400000,"dg":0,"ds":34400000},{"no":"INV/2026/02/0002","cust":"CV Laju Ekspedisi","issue":"2026-02-14","issueD":"14 Feb 2026","due":"2026-03-16","dueD":"16 Mar 2026","life":"posted","settle":"paid","total":33022500,"out":0,"dpp":29750000,"dg":0,"ds":29750000},{"no":"INV/2026/01/0001","cust":"CV Andalan Kirim","issue":"2026-01-26","issueD":"26 Jan 2026","due":"2026-02-25","dueD":"25 Feb 2026","life":"posted","settle":"paid","total":27139500,"out":0,"dpp":24450000,"dg":0,"ds":24450000},{"no":"INV/2026/01/0002","cust":"CV Trans Jaya","issue":"2026-01-20","issueD":"20 Jan 2026","due":"2026-02-19","dueD":"19 Feb 2026","life":"posted","settle":"paid","total":36741000,"out":0,"dpp":33100000,"dg":0,"ds":33100000},{"no":"INV/2026/01/0003","cust":"CV Andalan Kirim","issue":"2026-01-02","issueD":"2 Jan 2026","due":"2026-02-01","dueD":"1 Feb 2026","life":"posted","settle":"paid","total":31579500,"out":0,"dpp":28450000,"dg":0,"ds":28450000},{"no":"INV/2025/12/0002","cust":"CV Laju Ekspedisi","issue":"2025-12-19","issueD":"19 Des 2025","due":"2026-01-18","dueD":"18 Jan 2026","life":"posted","settle":"paid","total":30913500,"out":0,"dpp":27850000,"dg":0,"ds":27850000},{"no":"INV/2025/12/0001","cust":"CV Laju Ekspedisi","issue":"2025-12-18","issueD":"18 Des 2025","due":"2026-01-17","dueD":"17 Jan 2026","life":"posted","settle":"paid","total":40182000,"out":0,"dpp":36200000,"dg":0,"ds":36200000},{"no":"INV/2025/12/0003","cust":"PT Boga Utama","issue":"2025-12-02","issueD":"2 Des 2025","due":"2025-12-16","dueD":"16 Des 2025","life":"posted","settle":"paid","total":36574500,"out":0,"dpp":32950000,"dg":0,"ds":32950000},{"no":"INV/2025/11/0001","cust":"PT Sinar Cargo","issue":"2025-11-17","issueD":"17 Nov 2025","due":"2025-12-01","dueD":"1 Des 2025","life":"posted","settle":"paid","total":40126500,"out":0,"dpp":36150000,"dg":0,"ds":36150000},{"no":"INV/2025/11/0002","cust":"PT Boga Utama","issue":"2025-11-08","issueD":"8 Nov 2025","due":"2025-11-22","dueD":"22 Nov 2025","life":"posted","settle":"paid","total":31302000,"out":0,"dpp":28200000,"dg":0,"ds":28200000},{"no":"INV/2025/11/0003","cust":"PT Mitra Distribusi","issue":"2025-11-08","issueD":"8 Nov 2025","due":"2025-12-08","dueD":"8 Des 2025","life":"posted","settle":"paid","total":40681500,"out":0,"dpp":36650000,"dg":0,"ds":36650000},{"no":"INV/2025/10/0002","cust":"PT Boga Utama","issue":"2025-10-22","issueD":"22 Okt 2025","due":"2025-11-21","dueD":"21 Nov 2025","life":"posted","settle":"paid","total":35409000,"out":0,"dpp":31900000,"dg":0,"ds":31900000},{"no":"INV/2025/10/0003","cust":"PT Citra Boga","issue":"2025-10-14","issueD":"14 Okt 2025","due":"2025-11-13","dueD":"13 Nov 2025","life":"posted","settle":"paid","total":39127500,"out":0,"dpp":35250000,"dg":0,"ds":35250000},{"no":"INV/2025/10/0001","cust":"Toko Berkah Jaya","issue":"2025-10-12","issueD":"12 Okt 2025","due":"2025-10-26","dueD":"26 Okt 2025","life":"posted","settle":"paid","total":29803500,"out":0,"dpp":26850000,"dg":0,"ds":26850000},{"no":"INV/2025/09/0003","cust":"CV Laju Ekspedisi","issue":"2025-09-23","issueD":"23 Sep 2025","due":"2025-10-23","dueD":"23 Okt 2025","life":"posted","settle":"paid","total":30636000,"out":0,"dpp":27600000,"dg":0,"ds":27600000},{"no":"INV/2025/09/0001","cust":"CV Trans Jaya","issue":"2025-09-17","issueD":"17 Sep 2025","due":"2025-10-17","dueD":"17 Okt 2025","life":"posted","settle":"paid","total":30469500,"out":0,"dpp":27450000,"dg":0,"ds":27450000},{"no":"INV/2025/09/0002","cust":"CV Trans Jaya","issue":"2025-09-11","issueD":"11 Sep 2025","due":"2025-10-11","dueD":"11 Okt 2025","life":"posted","settle":"paid","total":36574500,"out":0,"dpp":32950000,"dg":0,"ds":32950000}],"aging":{"current":{"count":2,"amount":105838500},"d1_30":{"count":1,"amount":55888500},"d31_60":{"count":1,"amount":22255500},"d60_plus":{"count":0,"amount":0}},"items":[{"c":"JSA-0001","n":"Pengiriman Surabaya–Jakarta","p":4850000,"u":"UNIT"},{"c":"JSA-0002","n":"Pengiriman Surabaya–Bandung","p":5200000,"u":"UNIT"},{"c":"JSA-0003","n":"Pengiriman Surabaya–Semarang","p":2400000,"u":"UNIT"},{"c":"JSA-0004","n":"Sewa gudang bulanan","p":12500000,"u":"UNIT"},{"c":"JSA-0005","n":"Bongkar muat kontainer","p":1750000,"u":"UNIT"},{"c":"JSA-0006","n":"Asuransi pengiriman","p":950000,"u":"UNIT"}],"customers":[{"n":"PT Sinar Cargo","t":30},{"n":"CV Trans Jaya","t":30},{"n":"PT Boga Utama","t":30},{"n":"CV Andalan Kirim","t":30},{"n":"PT Mitra Distribusi","t":30},{"n":"Toko Berkah Jaya","t":30},{"n":"CV Laju Ekspedisi","t":30},{"n":"PT Citra Boga","t":30}],"activity":[{"who":"Dewi Lestari","ini":"DL","kind":"human","text":"mengajukan INV/2026/08/0004 untuk persetujuan","ago":"2 jam lalu"},{"who":"Sistem","ini":"SY","kind":"system","text":"menutup periode fiskal P4","ago":"6 hari lalu"},{"who":"Sari Wijaya","ini":"SW","kind":"human","text":"menambahkan tarif pengiriman Semarang","ago":"seminggu lalu"}]}]};

/* ---------------------------------------------------------------- token */
const CSS = `
.pf{--indigo-50:#F0EFFC;--indigo-100:#E0DEFA;--indigo-300:#A29CEA;--indigo-400:#7E76DC;
--indigo-500:#605AC9;--indigo-600:#3A34B5;--indigo-700:#302B96;--indigo-800:#282476;--indigo-950:#14123A;
--n-50:#F8F9FB;--n-100:#F1F2F6;--n-200:#E3E5EC;--n-300:#CBCEDA;--n-400:#9BA0B3;--n-450:#8A90A3;
--n-500:#6F7588;--n-600:#565C6E;--n-700:#434857;--n-800:#2E323D;--n-900:#1C1F27;--n-950:#101319;
--ok-50:#E9F7EF;--ok-600:#157552;--ok-200:#A3E0C3;--ok-950:#06211A;
--wr-50:#FEF5E7;--wr-600:#9C640A;--wr-200:#F8D28C;--wr-950:#2E1D05;
--dg-50:#FDECEC;--dg-600:#A82929;--dg-400:#E15252;--dg-200:#F6ADAD;--dg-950:#350E0E;
--bg:var(--n-50);--surf:#FFFFFF;--surf-r:#FFFFFF;--surf-s:var(--n-100);--acc-sub:var(--indigo-50);
--tx:var(--n-900);--tx-2:var(--n-600);--tx-3:#686E80;--tx-dis:var(--n-400);
--tx-acc:var(--indigo-700);--bd:var(--n-200);--bd-i:var(--n-450);--bd-st:var(--n-300);--bd-f:var(--indigo-600);
--act:var(--indigo-600);--act-h:var(--indigo-700);--ok-bg:var(--ok-50);--ok-tx:var(--ok-600);
--wr-bg:var(--wr-50);--wr-tx:var(--wr-600);--dg-bg:var(--dg-50);--dg-tx:var(--dg-600);
--row:44px;--pad:16px;--lh:20px;--ctrl:36px;
font-family:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
font-variant-numeric:tabular-nums;background:var(--bg);color:var(--tx);
-webkit-font-smoothing:antialiased;font-size:14px;line-height:var(--lh);}
.pf[data-theme="dark"]{--bg:var(--n-950);--surf:var(--n-900);--surf-r:var(--n-800);--surf-s:#0A0C11;
--acc-sub:var(--indigo-950);--tx:var(--n-100);--tx-2:var(--n-400);--tx-3:var(--n-450);--tx-dis:var(--n-600);
--tx-acc:var(--indigo-300);--bd:var(--n-800);--bd-i:var(--n-500);--bd-st:var(--n-700);--bd-f:var(--indigo-400);
--act:var(--indigo-500);--act-h:var(--indigo-400);--ok-bg:var(--ok-950);--ok-tx:var(--ok-200);
--wr-bg:var(--wr-950);--wr-tx:var(--wr-200);--dg-bg:var(--dg-950);--dg-tx:var(--dg-200);}
.pf[data-density="compact"]{--row:32px;--pad:12px;--lh:18px;--ctrl:30px;}
.pf *{box-sizing:border-box;}
.pf button{font:inherit;color:inherit;background:none;border:none;cursor:pointer;padding:0;}
.pf :focus-visible{outline:2px solid var(--bd-f);outline-offset:2px;border-radius:4px;}
.pf .ovl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--tx-3);}
.pf .card{background:var(--surf);border:1px solid var(--bd);border-radius:12px;}
.pf .btn{height:var(--ctrl);padding:0 12px;border-radius:6px;font-weight:500;font-size:13px;
display:inline-flex;align-items:center;gap:6px;transition:background .1s;}
.pf .btn-p{background:var(--act);color:#fff;}
.pf .btn-p:hover{background:var(--act-h);}
.pf .btn-s{border:1px solid var(--bd-i);background:var(--surf);}
.pf .btn-s:hover{background:var(--surf-s);}
.pf .rail-i{width:34px;height:34px;border-radius:7px;display:flex;align-items:center;
justify-content:center;color:var(--tx-2);transition:background .1s;position:relative;}
.pf .rail-i:hover{background:var(--surf-s);}
.pf .rail-i[aria-current="page"]{background:var(--acc-sub);color:var(--tx-acc);}
.pf .nav-i{display:block;width:100%;text-align:left;font-size:13px;padding:0 10px;
border-radius:6px;color:var(--tx-2);height:32px;line-height:32px;}
.pf .nav-i:hover{background:var(--surf-s);color:var(--tx);}
.pf .nav-i[aria-current="page"]{background:var(--surf-s);color:var(--tx);font-weight:500;}
.pf table{width:100%;border-collapse:collapse;}
.pf th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--tx-2);
font-weight:500;padding:8px 12px;border-bottom:1px solid var(--bd-st);text-align:left;
background:var(--surf-s);position:sticky;top:0;z-index:1;white-space:nowrap;}
.pf td{padding:0 12px;height:var(--row);border-bottom:1px solid var(--bd);font-size:13px;}
.pf tbody tr:hover td{background:var(--surf-s);}
.pf tbody tr[data-sel="1"] td{background:var(--acc-sub);}
.pf .num{text-align:right;}
.pf .pill{font-size:11px;padding:3px 9px;border-radius:11px;display:inline-flex;
align-items:center;gap:5px;white-space:nowrap;}
.pf .dot{width:5px;height:5px;border-radius:50%;background:currentColor;flex:none;}
.pf .chip{font-size:12px;padding:5px 11px;border-radius:16px;border:1px solid var(--bd-i);
background:var(--surf);color:var(--tx-2);}
.pf .chip[aria-pressed="true"]{background:var(--acc-sub);color:var(--tx-acc);border-color:transparent;font-weight:500;}
.pf .skip{position:absolute;left:-9999px;top:8px;z-index:60;background:var(--act);color:#fff;
padding:8px 14px;border-radius:6px;font-size:13px;}
.pf .skip:focus{left:12px;}
.pf .bar{fill:var(--n-200);}
.pf[data-theme="dark"] .bar{fill:var(--n-800);}
.pf .bar-on{fill:var(--act);}
@keyframes slideIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.pf .anim{animation:slideIn .16s cubic-bezier(0,0,0,1);}
@media (prefers-reduced-motion:reduce){.pf *{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
@media (pointer:coarse){.pf .rail-i{width:44px;height:44px;}.pf .btn{height:44px;}
.pf .nav-i{height:44px;line-height:44px;}.pf td{height:max(var(--row),44px);}}
`;

/* ---------------------------------------------------------------- util */
const rp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const short = (n) =>
  n >= 1e9 ? "Rp " + (n / 1e9).toFixed(2).replace(".", ",") + " M"
           : "Rp " + Math.round(n / 1e6).toLocaleString("id-ID") + " jt";
const pct = (a, b) => (b === 0 ? 0 : ((a - b) / b) * 100);

const LIFE = {
  draft: ["Draf", "n"], submitted: ["Diajukan", "n"],
  pending_approval: ["Menunggu persetujuan", "w"], posted: ["Diposting", "o"],
};
const SETTLE = { paid: ["Lunas", "o"], partially_paid: ["Dibayar sebagian", "w"], unpaid: ["Belum dibayar", "n"] };

function Pill({ label, tone }) {
  const m = { o: ["var(--ok-bg)", "var(--ok-tx)"], w: ["var(--wr-bg)", "var(--wr-tx)"],
              d: ["var(--dg-bg)", "var(--dg-tx)"], n: ["var(--surf-s)", "var(--tx-2)"] }[tone];
  return <span className="pill" style={{ background: m[0], color: m[1] }}><span className="dot" />{label}</span>;
}

function statusOf(inv) {
  if (inv.life !== "posted") return [LIFE[inv.life][0], LIFE[inv.life][1]];
  if (inv.settle === "paid") return ["Lunas", "o"];
  if (new Date(inv.due) < new Date("2026-08-10")) return ["Jatuh tempo", "d"];
  if (inv.settle === "partially_paid") return ["Dibayar sebagian", "w"];
  return ["Belum dibayar", "n"];
}

/* ---------------------------------------------------------------- polish */
function useCountUp(target, ms = 520) {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (prev.current === target) { setV(target); return; }
    const reduce = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { prev.current = target; setV(target); return; }
    const from = prev.current, t0 = performance.now();
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else prev.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function useTrap(ref, onClose) {
  useEffect(() => {
    const prev = document.activeElement;
    const node = ref.current;
    node?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !node) return;
      const f = node.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [ref, onClose]);
}

function TableSkeleton() {
  const w = ["18%", "26%", "14%", "14%", "12%", "16%"];
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 12, padding: "10px 12px", background: "var(--surf-s)",
        borderBottom: "1px solid var(--bd-st)" }}>
        {w.map((x, i) => <div key={i} style={{ width: x, height: 9, borderRadius: 3, background: "var(--bd)" }} />)}
      </div>
      {[...Array(8)].map((_, r) => (
        <div key={r} style={{ display: "flex", gap: 12, alignItems: "center", padding: "0 12px",
          height: "var(--row)", borderBottom: "1px solid var(--bd)", opacity: 1 - r * 0.07 }}>
          {w.map((x, i) => (
            <div key={i} style={{ width: x, height: 11, borderRadius: 3, background: "var(--surf-s)" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Palette({ co, db, onNav, onCompany, onClose }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const box = useRef(null);
  const inp = useRef(null);
  useEffect(() => { inp.current?.focus(); }, []);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    const nav = [
      { t: "Dashboard", go: { mod: "dash" } },
      { t: "Penjualan · Faktur", go: { mod: "sales", page: "Faktur" } },
      { t: "Penjualan · Pelanggan", go: { mod: "sales", page: "Pelanggan" } },
      { t: "Akuntansi · Laba rugi", go: { mod: "acc", page: "Laba rugi" } },
      { t: "Akuntansi · Jurnal umum", go: { mod: "acc", page: "Jurnal umum" } },
    ].filter((x) => !s || x.t.toLowerCase().includes(s));
    const act = [
      { t: "Buat faktur baru", go: { mod: "sales", page: "Faktur", view: "form" } },
    ].filter((x) => !s || x.t.toLowerCase().includes(s));
    const ent = !s ? [] : co.invoices
      .filter((x) => x.no.toLowerCase().includes(s) || x.cust.toLowerCase().includes(s))
      .slice(0, 5).map((x) => ({ t: x.no, sub: `${x.cust} · ${rp(x.total)}`, inv: x }));
    const comp = db.companies.filter((c) => c.id !== co.id && (!s || c.name.toLowerCase().includes(s)))
      .map((c) => ({ t: `Pindah ke ${c.name}`, sub: `${c.fyLabel} · ${c.fyRange}`, co: c }));
    return [["Navigasi", nav], ["Aksi", act], ["Faktur", ent], ["Company", comp]]
      .filter(([, arr]) => arr.length);
  }, [q, co, db]);

  const flat = groups.flatMap(([, arr]) => arr);
  useEffect(() => { setI(0); }, [q]);

  const run = (it) => {
    if (it.co) onCompany(it.co);
    else onNav(it);
    onClose();
  };
  const key = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => (v + 1) % Math.max(1, flat.length)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => (v - 1 + flat.length) % Math.max(1, flat.length)); }
    if (e.key === "Enter" && flat[i]) { e.preventDefault(); run(flat[i]); }
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  let n = -1;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(16,19,25,.45)", zIndex: 50 }} onClick={onClose} />
      <div ref={box} role="dialog" aria-modal="true" aria-label="Perintah cepat" className="card anim"
        onKeyDown={key}
        style={{ position: "fixed", zIndex: 51, top: 84, left: "50%", transform: "translateX(-50%)",
          width: "min(600px,94vw)", maxHeight: "70vh", overflow: "hidden", display: "flex",
          flexDirection: "column", boxShadow: "0 20px 48px rgba(16,19,25,.24)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px",
          borderBottom: "1px solid var(--bd)" }}>
          <Search size={16} style={{ color: "var(--tx-3)" }} />
          <input ref={inp} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Cari modul, aksi, faktur, atau company" aria-label="Perintah cepat"
            style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: 14, color: "var(--tx)" }} />
          <span style={{ fontSize: 11, color: "var(--tx-3)" }}>esc</span>
        </div>
        <div style={{ overflowY: "auto" }}>
          {flat.length === 0 && (
            <div style={{ padding: "34px 16px", textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500 }}>Tidak ada yang cocok</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--tx-2)" }}>
                Coba nomor faktur, nama pelanggan, atau nama modul.</p>
            </div>
          )}
          {groups.map(([label, arr]) => (
            <div key={label}>
              <p className="ovl" style={{ margin: 0, padding: "10px 14px 4px" }}>{label}</p>
              {arr.map((it) => {
                n += 1;
                const on = n === i;
                return (
                  <button key={label + it.t} onMouseEnter={() => setI(n)} onClick={() => run(it)}
                    style={{ display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "8px 14px",
                      alignItems: "center", background: on ? "var(--surf-s)" : "transparent" }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13 }}>{it.t}</span>
                      {it.sub && <span style={{ display: "block", fontSize: 11, color: "var(--tx-3)" }}>{it.sub}</span>}
                    </span>
                    {on && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--tx-3)" }}>⏎</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 14px", borderTop: "1px solid var(--bd)", background: "var(--surf-s)",
          fontSize: 11, color: "var(--tx-3)" }}>
          ↑↓ pilih · ⏎ jalankan · Hasil dibatasi company aktif dan izin Anda
        </div>
      </div>
    </>
  );
}

const SHORTCUTS = [
  ["⌘K / Ctrl+K", "Buka perintah cepat"],
  ["?", "Tampilkan bantuan pintasan"],
  ["Esc", "Tutup lapisan teratas"],
  ["↑ ↓", "Pilih di daftar dan pengalih company"],
  ["⏎", "Jalankan pilihan · di form, tambah baris"],
  ["Tab", "Pindah sel di editor baris"],
];

function Help({ onClose }) {
  const box = useRef(null);
  useTrap(box, onClose);
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(16,19,25,.45)", zIndex: 52 }} onClick={onClose} />
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Pintasan keyboard"
        className="card anim"
        style={{ position: "fixed", zIndex: 53, top: "18%", left: "50%", transform: "translateX(-50%)",
          width: "min(460px,92vw)", padding: 20, boxShadow: "0 16px 40px rgba(16,19,25,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Pintasan keyboard</h2>
          <button onClick={onClose} aria-label="Tutup" style={{ marginLeft: "auto", color: "var(--tx-3)" }}>
            <X size={16} /></button>
        </div>
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 12, padding: "7px 0", fontSize: 13,
            borderBottom: "1px solid var(--bd)" }}>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, minWidth: 108,
              color: "var(--tx-2)" }}>{k}</span>
            <span>{v}</span>
          </div>
        ))}
        <p style={{ margin: "14px 0 0", fontSize: 11.5, color: "var(--tx-3)" }}>
          Pintasan nonaktif saat kursor berada di dalam kolom isian.
        </p>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- switcher */
function Switcher({ co, onPick, onClose }) {
  const [i, setI] = useState(DATA.companies.findIndex((c) => c.id === co.id));
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    return () => prev?.focus?.();
  }, []);
  const key = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => (v + 1) % DATA.companies.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => (v - 1 + DATA.companies.length) % DATA.companies.length); }
    if (e.key === "Enter") { e.preventDefault(); onPick(DATA.companies[i]); }
  };
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={onClose} />
      <div ref={ref} tabIndex={-1} onKeyDown={key} role="dialog" aria-label="Pilih company"
        className="card anim"
        style={{ position: "absolute", top: 42, left: 0, width: 340, zIndex: 41,
                 boxShadow: "0 12px 32px rgba(16,19,25,.14)", overflow: "hidden" }}>
        <div style={{ padding: "9px 12px", borderBottom: "1px solid var(--bd)", display: "flex", gap: 7, alignItems: "center", color: "var(--tx-3)", fontSize: 13 }}>
          <Search size={14} /> Cari company
        </div>
        <p className="ovl" style={{ margin: 0, padding: "10px 13px 4px" }}>{DATA.tenant.name} · tenant aktif</p>
        {DATA.companies.map((c, idx) => {
          const on = c.id === co.id;
          return (
            <button key={c.id} onClick={() => onPick(c)} onMouseEnter={() => setI(idx)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 13px",
                       background: idx === i ? "var(--surf-s)" : "transparent", textAlign: "left" }}>
              <span style={{ width: 28, height: 28, borderRadius: 7, flex: "none", display: "flex",
                             alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 500,
                             background: on ? "var(--act)" : "var(--surf-s)",
                             color: on ? "#fff" : "var(--tx-2)",
                             border: on ? "none" : "1px solid var(--bd)" }}>{c.ini}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 500 }}>{c.name}</span>
                <span style={{ display: "block", fontSize: 10.5, color: "var(--tx-3)" }}>
                  {c.tax} · {c.cur} · {c.fyRange}
                </span>
              </span>
              {on && <Check size={16} style={{ marginLeft: "auto", color: "var(--tx-acc)" }} />}
            </button>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", padding: "9px 13px", borderTop: "1px solid var(--bd)", background: "var(--surf-s)" }}>
          <span style={{ fontSize: 11.5, color: "var(--tx-2)" }}>Kelola company</span>
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--tx-3)" }}>↑↓ pilih · ⏎ pindah · esc tutup</span>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- dashboard */
function Kpi({ label, raw, fmt, delta, unit, invert }) {
  const shown = useCountUp(raw);
  const up = delta >= 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="card" style={{ flex: 1, minWidth: 0, padding: "13px 14px" }}>
      <p className="ovl" style={{ margin: "0 0 6px" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-.01em" }}>{fmt(shown)}</p>
      <p style={{ margin: "5px 0 0", fontSize: 11, display: "flex", alignItems: "center", gap: 3,
                  color: good ? "var(--ok-tx)" : "var(--dg-tx)" }}>
        <Icon size={13} />{Math.abs(delta).toFixed(1).replace(".", ",")}{unit} vs bulan lalu
      </p>
    </div>
  );
}

function Dashboard({ co }) {
  const k = co.kpi;
  const max = Math.max(...co.monthly.map((m) => m.rev));
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Kpi label="Kas & bank" raw={k.cash} fmt={short} delta={pct(k.cash, k.cashPrev)} unit="%" />
        <Kpi label="Piutang beredar" raw={k.ar} fmt={short} delta={pct(k.ar, k.arPrev)} unit="%" invert />
        <Kpi label="Penjualan bulan ini" raw={k.sales} fmt={short} delta={pct(k.sales, k.salesPrev)} unit="%" />
        <Kpi label="Margin kotor" raw={k.gm} fmt={(n) => n.toFixed(1).replace(".", ",") + "%"}
          delta={k.gm - k.gmPrev} unit=" poin" />
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Penjualan 12 bulan</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--tx-3)" }}>dalam juta rupiah</span>
        </div>
        <svg viewBox="0 0 640 146" style={{ width: "100%", height: "auto" }} role="img"
          aria-label={`Grafik penjualan 12 bulan, tertinggi ${co.monthly[11].label}.`}>
          <line x1="0" y1="120" x2="640" y2="120" stroke="var(--bd)" strokeWidth="1" />
          {co.monthly.map((m, i) => {
            const h = (m.rev / max) * 96;
            const last = i === 11;
            return (
              <g key={m.label}>
                <rect x={i * 52} y={120 - h} width="40" height={h} rx="3" className={last ? "bar-on" : "bar"} />
                <text x={i * 52 + 20} y="136" textAnchor="middle" fontSize="9" fill="var(--tx-3)">{m.label.split(" ")[0]}</text>
                {last && <text x={i * 52 + 20} y={114 - h} textAnchor="middle" fontSize="10"
                  fill="var(--tx-acc)" fontWeight="500">{Math.round(m.rev / 1e6)}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: 1, minWidth: 260, padding: 14 }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500 }}>Perlu tindakan</p>
          <Row icon={<AlertTriangle size={15} style={{ color: "var(--dg-tx)" }} />}
            text={`${k.arOverCount} faktur jatuh tempo · ${short(k.arOver)}`} />
          <Row icon={<Clock size={15} style={{ color: "var(--wr-tx)" }} />}
            text={`${co.invoices.filter((i) => i.life === "pending_approval").length} faktur menunggu persetujuan`} />
          <Row icon={<Package size={15} style={{ color: "var(--tx-2)" }} />}
            text="1 pesanan pembelian belum diterima" last />
        </div>
        <div className="card" style={{ flex: 1, minWidth: 260, padding: 14 }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500 }}>Aktivitas terkini</p>
          {co.activity.map((a, i) => (
            <Row key={i} last={i === co.activity.length - 1}
              icon={<Actor a={a} />}
              text={<><b style={{ fontWeight: 500 }}>{a.who}</b> {a.text}</>} ago={a.ago} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Actor({ a }) {
  const s = { width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 9, fontWeight: 500, flex: "none" };
  if (a.kind === "ai") return <span style={{ ...s, background: "var(--acc-sub)", color: "var(--tx-acc)" }}><Sparkles size={11} /></span>;
  if (a.kind === "system") return <span style={{ ...s, background: "var(--surf-s)", color: "var(--tx-3)" }}><Settings size={11} /></span>;
  return <span style={{ ...s, background: "var(--surf-s)", color: "var(--tx-2)" }}>{a.ini}</span>;
}

function Row({ icon, text, ago, last }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 0", fontSize: 12.5,
                  borderBottom: last ? "none" : "1px solid var(--bd)" }}>
      <span style={{ flex: "none", marginTop: 1 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>{text}</span>
      {ago && <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--tx-3)", whiteSpace: "nowrap" }}>{ago}</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- invoices */
const PER = 12;
function Invoices({ co, onOpen }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const [sort, setSort] = useState({ k: "issue", d: -1 });
  const [sel, setSel] = useState(new Set());
  const [page, setPage] = useState(0);
  const [allMatch, setAllMatch] = useState(false);

  useEffect(() => { setSel(new Set()); setPage(0); setAllMatch(false); }, [q, f, co.id]);

  const rows = useMemo(() => {
    let r = co.invoices.filter((i) => {
      const s = statusOf(i)[0];
      if (f === "open" && (i.settle === "paid" || i.life !== "posted")) return false;
      if (f === "overdue" && s !== "Jatuh tempo") return false;
      if (f === "draft" && i.life === "posted") return false;
      if (q && !(i.no.toLowerCase().includes(q.toLowerCase()) || i.cust.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
    const { k, d } = sort;
    return [...r].sort((a, b) => {
      const va = k === "total" ? a.total : k === "cust" ? a.cust : a[k];
      const vb = k === "total" ? b.total : k === "cust" ? b.cust : b[k];
      return va < vb ? -d : va > vb ? d : 0;
    });
  }, [co, q, f, sort]);

  const pageRows = rows.slice(page * PER, page * PER + PER);
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => sel.has(r.no));
  const toggleAll = () => {
    const n = new Set(sel);
    if (allOnPage) pageRows.forEach((r) => n.delete(r.no));
    else pageRows.forEach((r) => n.add(r.no));
    setSel(n); setAllMatch(false);
  };
  const th = (k, label, num) => (
    <th scope="col" className={num ? "num" : ""}
      aria-sort={sort.k === k ? (sort.d === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ k, d: s.k === k ? -s.d : -1 }))}
        aria-label={`Urutkan menurut ${label}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 3, font: "inherit",
                 color: "inherit", textTransform: "inherit", letterSpacing: "inherit" }}>
        {label}{sort.k === k && (sort.d === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--bd-i)",
                      borderRadius: 6, padding: "0 10px", height: "var(--ctrl)", background: "var(--surf)" }}>
          <Search size={14} style={{ color: "var(--tx-3)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nomor atau pelanggan"
            aria-label="Cari faktur"
            style={{ border: "none", background: "none", outline: "none", fontSize: 13, width: 200, color: "var(--tx)" }} />
        </div>
        {[["all", "Semua"], ["open", "Belum lunas"], ["overdue", "Jatuh tempo"], ["draft", "Belum diposting"]].map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--tx-3)" }}>{rows.length} faktur</span>
      </div>

      {sel.size > 0 && (
        <div className="anim" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 13px",
          background: "var(--acc-sub)", borderRadius: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--tx-acc)" }}>
            {allMatch ? `${rows.length} baris terpilih` : `${sel.size} baris terpilih di halaman ini`}
          </span>
          {!allMatch && rows.length > pageRows.length && (
            <button onClick={() => setAllMatch(true)}
              style={{ fontSize: 12, color: "var(--tx-acc)", textDecoration: "underline" }}>
              Pilih semua {rows.length} baris yang cocok dengan filter
            </button>
          )}
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="btn btn-s" style={{ height: 28 }}>Kirim</button>
            <button className="btn btn-s" style={{ height: 28 }}>Ekspor</button>
            <button className="btn btn-s" style={{ height: 28, color: "var(--dg-tx)" }}>Batalkan</button>
          </span>
          <button onClick={() => { setSel(new Set()); setAllMatch(false); }} aria-label="Batal pilih"><X size={15} /></button>
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th scope="col" style={{ width: 40 }}>
                  <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Pilih semua di halaman ini" />
                </th>
                {th("no", "Nomor")}{th("cust", "Pelanggan")}{th("issue", "Terbit")}{th("due", "Jatuh tempo")}
                <th scope="col">Status</th>{th("total", "Jumlah", true)}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((i) => {
                const [lbl, tone] = statusOf(i);
                const on = allMatch || sel.has(i.no);
                return (
                  <tr key={i.no} data-sel={on ? "1" : "0"} style={{ cursor: "pointer" }}
                    onClick={(e) => { if (e.target.type !== "checkbox") onOpen(i); }}>
                    <td><input type="checkbox" checked={on} aria-label={`Pilih ${i.no}`}
                      onChange={() => { const n = new Set(sel); n.has(i.no) ? n.delete(i.no) : n.add(i.no); setSel(n); setAllMatch(false); }} /></td>
                    <td style={{ fontFamily: "'IBM Plex Mono',ui-monospace,monospace", fontSize: 12.5 }}>
                      <button onClick={(e) => { e.stopPropagation(); onOpen(i); }}
                        aria-label={`Buka faktur ${i.no} untuk ${i.cust}`}
                        style={{ font: "inherit", color: "var(--tx-acc)", textAlign: "left" }}>{i.no}</button>
                    </td>
                    <td>{i.cust}</td>
                    <td style={{ color: "var(--tx-2)" }}>{i.issueD}</td>
                    <td style={{ color: "var(--tx-2)" }}>{i.dueD}</td>
                    <td><Pill label={lbl} tone={tone} /></td>
                    <td className="num">{rp(i.total)}</td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr><td colSpan={7} style={{ height: 140, textAlign: "center", verticalAlign: "middle" }}>
                  <span style={{ display: "block", fontWeight: 500, marginBottom: 4 }}>Tidak ada faktur yang cocok</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--tx-2)", marginBottom: 10 }}>
                    Ada {co.invoices.length} faktur di company ini, tapi tidak ada yang cocok dengan filter Anda.
                  </span>
                  <button className="btn btn-s" onClick={() => { setQ(""); setF("all"); }}>Hapus filter</button>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 13px",
                      borderTop: "1px solid var(--bd)", fontSize: 12, color: "var(--tx-2)" }}>
          <span>{rows.length === 0 ? 0 : page * PER + 1}–{Math.min(rows.length, (page + 1) * PER)} dari {rows.length}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
              style={{ height: 28, padding: "0 10px", borderRadius: 5, border: "1px solid var(--bd)",
                       color: page === 0 ? "var(--tx-dis)" : "var(--tx)", cursor: page === 0 ? "default" : "pointer" }}>
              Sebelumnya</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * PER >= rows.length}
              style={{ height: 28, padding: "0 10px", borderRadius: 5, border: "1px solid var(--bd-st)",
                       color: (page + 1) * PER >= rows.length ? "var(--tx-dis)" : "var(--tx)",
                       cursor: (page + 1) * PER >= rows.length ? "default" : "pointer" }}>
              Berikutnya</button>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- form faktur */
const TAX_RATE = 0.11;

function calcInvoice(lines, discPct) {
  const rows = lines.map((l) => ({ ...l, amount: (Number(l.qty) || 0) * (Number(l.price) || 0) }));
  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const discount = subtotal * (Number(discPct) || 0) / 100;
  // diskon dokumen dialokasikan proporsional ke baris, lalu pajak dihitung per baris
  const priced = rows.map((r) => {
    const alloc = subtotal === 0 ? 0 : (r.amount / subtotal) * discount;
    const net = r.amount - alloc;
    return { ...r, alloc, net, tax: net * TAX_RATE };
  });
  const dpp = priced.reduce((s, r) => s + r.net, 0);
  const tax = priced.reduce((s, r) => s + r.tax, 0);
  // pembulatan hanya di akhir
  const rDisc = Math.round(discount), rDpp = Math.round(dpp), rTax = Math.round(tax);
  return { rows: priced, subtotal, discount: rDisc, dpp: rDpp, tax: rTax, total: rDpp + rTax };
}

function InvoiceForm({ co, onCancel, onPublish }) {
  const [cust, setCust] = useState("");
  const [discPct, setDiscPct] = useState(0);
  const [lines, setLines] = useState([{ id: 1, code: "", qty: "", price: "" }]);
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const nextId = useRef(2);

  const c = calcInvoice(lines, discPct);
  const custObj = co.customers.find((x) => x.n === cust);
  const term = custObj ? custObj.t : 30;

  const errs = [];
  if (!cust) errs.push(["cust", "Pilih pelanggan lebih dulu."]);
  const valid = lines.filter((l) => l.code && Number(l.qty) > 0);
  if (valid.length === 0) errs.push(["lines", "Tambahkan minimal satu baris dengan barang dan kuantitas."]);
  lines.forEach((l, i) => {
    if (l.code && !(Number(l.qty) > 0)) errs.push([`q${i}`, `Baris ${i + 1}: kuantitas harus lebih dari nol.`]);
  });

  const setLine = (id, patch) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((ls) => [...ls, { id: nextId.current++, code: "", qty: "", price: "" }]);
  const delLine = (id) => setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.id !== id)));

  const pickItem = (id, code) => {
    const it = co.items.find((x) => x.c === code);
    setLine(id, { code, price: it ? it.p : "" });
  };

  const onKey = (e, idx, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (idx === lines.length - 1 && field === "price") addLine();
    }
  };

  const dueDate = () => {
    const d = new Date("2026-08-10T00:00:00");
    d.setDate(d.getDate() + term);
    const MN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${d.getDate()} ${MN[d.getMonth()]} ${d.getFullYear()}`;
  };

  const inp = {
    height: "var(--ctrl)", border: "1px solid var(--bd-i)", borderRadius: 6, padding: "0 10px",
    fontSize: 13, background: "var(--surf)", color: "var(--tx)", outline: "none", width: "100%",
  };
  const cell = { padding: "5px 6px", borderBottom: "1px solid var(--bd)" };

  return (
    <div>
      {touched && errs.length > 0 && (
        <div className="anim" role="alert" style={{ background: "var(--dg-bg)", borderRadius: 8,
          padding: "11px 14px", marginBottom: 12 }}>
          <p style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 500, color: "var(--dg-tx)" }}>
            {errs.length} hal perlu diperbaiki sebelum faktur dapat diterbitkan
          </p>
          {errs.map(([k, m]) => (
            <p key={k} style={{ margin: 0, fontSize: 12, color: "var(--dg-tx)" }}>· {m}</p>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 260px", minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 5 }}>Pelanggan</span>
            <select value={cust} onChange={(e) => setCust(e.target.value)} style={inp}
              aria-invalid={touched && !cust}>
              <option value="">Pilih pelanggan</option>
              {co.customers.map((x) => <option key={x.n} value={x.n}>{x.n}</option>)}
            </select>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--tx-2)", marginTop: 5 }}>
              {custObj ? `Termin ${term} hari · jatuh tempo ${dueDate()}` : "Termin pembayaran mengikuti pelanggan"}
            </span>
          </label>
          <label style={{ flex: "0 0 140px" }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 5 }}>Tanggal terbit</span>
            <input value="10 Agu 2026" readOnly style={{ ...inp, background: "var(--surf-s)", color: "var(--tx-2)" }} />
          </label>
          <label style={{ flex: "0 0 140px" }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 5 }}>Mata uang</span>
            <input value={co.cur} readOnly style={{ ...inp, background: "var(--surf-s)", color: "var(--tx-2)" }} />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th scope="col" style={{ width: 34 }}>#</th>
                <th scope="col">Barang atau jasa</th>
                <th scope="col" style={{ width: 96 }} className="num">Qty</th>
                <th scope="col" style={{ width: 130 }} className="num">Harga satuan</th>
                <th scope="col" style={{ width: 130 }} className="num">Jumlah</th>
                <th scope="col" style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {c.rows.map((l, i) => (
                <tr key={l.id}>
                  <td style={{ ...cell, color: "var(--tx-3)", fontSize: 12 }}>{i + 1}</td>
                  <td style={cell}>
                    <select value={l.code} onChange={(e) => pickItem(l.id, e.target.value)}
                      aria-label={`Barang baris ${i + 1}`} style={{ ...inp, height: 30 }}>
                      <option value="">Pilih barang atau jasa</option>
                      {co.items.map((it) => <option key={it.c} value={it.c}>{it.n}</option>)}
                    </select>
                  </td>
                  <td style={cell}>
                    <input value={l.qty} inputMode="numeric" aria-label={`Kuantitas baris ${i + 1}`}
                      onChange={(e) => setLine(l.id, { qty: e.target.value.replace(/[^0-9]/g, "") })}
                      onKeyDown={(e) => onKey(e, i, "qty")}
                      style={{ ...inp, height: 30, textAlign: "right",
                               borderColor: touched && l.code && !(Number(l.qty) > 0) ? "var(--dg-tx)" : "var(--bd-i)" }} />
                  </td>
                  <td style={cell}>
                    <input value={l.price === "" ? "" : Number(l.price).toLocaleString("id-ID")}
                      inputMode="numeric" aria-label={`Harga satuan baris ${i + 1}`}
                      onChange={(e) => setLine(l.id, { price: e.target.value.replace(/[^0-9]/g, "") })}
                      onKeyDown={(e) => onKey(e, i, "price")}
                      style={{ ...inp, height: 30, textAlign: "right" }} />
                  </td>
                  <td style={{ ...cell, textAlign: "right", fontSize: 13 }}>
                    {l.amount ? l.amount.toLocaleString("id-ID") : "—"}
                  </td>
                  <td style={{ ...cell, textAlign: "center" }}>
                    <button onClick={() => delLine(l.id)} aria-label={`Hapus baris ${i + 1}`}
                      style={{ color: "var(--tx-3)", padding: 4 }} disabled={lines.length === 1}>
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-s" style={{ height: 28 }} onClick={addLine}>Tambah baris</button>
          <span style={{ fontSize: 11, color: "var(--tx-3)" }}>Enter di kolom harga menambah baris baru</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div className="card" style={{ width: 380, padding: "12px 14px" }}>
          <Tot label="Subtotal" v={c.subtotal} />
          <div style={{ display: "flex", alignItems: "center", padding: "5px 0", fontSize: 13 }}>
            <span style={{ color: "var(--tx-2)" }}>Diskon dokumen</span>
            <input value={discPct} inputMode="numeric" aria-label="Diskon dokumen persen"
              onChange={(e) => setDiscPct(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              style={{ width: 44, marginLeft: 8, height: 26, textAlign: "right", border: "1px solid var(--bd-i)",
                       borderRadius: 5, background: "var(--surf)", color: "var(--tx)", fontSize: 12, padding: "0 6px" }} />
            <span style={{ marginLeft: 4, color: "var(--tx-2)" }}>%</span>
            <span style={{ marginLeft: "auto" }}>{c.discount ? `(${c.discount.toLocaleString("id-ID")})` : "—"}</span>
          </div>
          <Tot label="Dasar pengenaan pajak" v={c.dpp} />
          <Tot label={`PPN ${TAX_RATE * 100}%`} v={c.tax} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, paddingTop: 10, marginTop: 6,
                        borderTop: "1px solid var(--bd-st)" }}>
            <span style={{ fontSize: 13, color: "var(--tx-2)" }}>Total tagihan</span>
            <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 600, letterSpacing: "-.01em" }}>
              {rp(c.total)}</span>
          </div>
          {Number(discPct) > 0 && (
            <p style={{ margin: "9px 0 0", fontSize: 11, color: "var(--tx-3)", lineHeight: 1.45 }}>
              Diskon dialokasikan proporsional ke setiap baris sebelum pajak dihitung, sesuai aturan
              perhitungan di Flow Archetypes. Pembulatan hanya dilakukan di langkah terakhir.
            </p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", position: "sticky", bottom: 0,
        background: "var(--bg)", padding: "10px 0", borderTop: "1px solid var(--bd)" }}>
        <button className="btn btn-s" onClick={onCancel}>Batal</button>
        <button className="btn btn-s">Simpan sebagai draf</button>
        <button className="btn btn-p"
          onClick={() => { setTouched(true); if (errs.length === 0) setConfirm(true); }}>
          Terbitkan faktur
        </button>
      </div>

      {confirm && (
        <Confirm co={co} cust={cust} total={c.total} onCancel={() => setConfirm(false)}
          onOk={() => { setConfirm(false); onPublish({ cust, lines: c.rows.filter((l) => l.code && Number(l.qty) > 0), ...c, term }); }} />
      )}
    </div>
  );
}

function Tot({ label, v }) {
  return (
    <div style={{ display: "flex", padding: "5px 0", fontSize: 13 }}>
      <span style={{ color: "var(--tx-2)" }}>{label}</span>
      <span style={{ marginLeft: "auto" }}>{v ? v.toLocaleString("id-ID") : "—"}</span>
    </div>
  );
}

function Confirm({ co, cust, total, onCancel, onOk }) {
  const ref = useRef(null);
  useTrap(ref, onCancel);
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(16,19,25,.45)", zIndex: 50 }} onClick={onCancel} />
      <div role="dialog" aria-modal="true" aria-label="Konfirmasi penerbitan faktur" ref={ref} tabIndex={-1}
        className="card anim"
        style={{ position: "fixed", zIndex: 51, top: "24%", left: "50%", transform: "translateX(-50%)",
                 width: "min(440px,92vw)", padding: 20, boxShadow: "0 16px 40px rgba(16,19,25,.2)" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 500 }}>Terbitkan faktur ini?</h2>
        <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--tx-2)", lineHeight: 1.5 }}>
          Faktur senilai <b style={{ color: "var(--tx)" }}>{rp(total)}</b> untuk {cust} akan diterbitkan
          atas nama <b style={{ color: "var(--tx)" }}>{co.name}</b>.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--tx-2)", lineHeight: 1.5 }}>
          Setelah diterbitkan, faktur menulis ke buku besar dan tidak dapat diedit — hanya dibatalkan
          lewat jurnal pembalik.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-s" onClick={onCancel}>Batal</button>
          <button className="btn btn-p" onClick={onOk}>Terbitkan</button>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- detail */
function InvoiceDetail({ co, inv, onBack }) {
  const [lbl, tone] = statusOf(inv);
  const lines = inv.lines || [];
  return (
    <div>
      <button onClick={onBack} className="btn btn-s" style={{ marginBottom: 12, height: 28 }}>
        ← Kembali ke daftar</button>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 380px", minWidth: 0 }}>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13 }}>
              <Meta k="Pelanggan" v={inv.cust} />
              <Meta k="Terbit" v={inv.issueD} />
              <Meta k="Jatuh tempo" v={inv.dueD} />
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, marginTop: 12 }}>
              <Meta k="Siklus hidup" v={<Pill label={LIFE[inv.life][0]} tone={LIFE[inv.life][1]} />} />
              <Meta k="Pelunasan" v={<Pill label={SETTLE[inv.settle][0]} tone={SETTLE[inv.settle][1]} />} />
              <Meta k="Pemenuhan" v={<Pill label={inv.life === "posted" ? "Terpenuhi" : "Belum"} tone="n" />} />
            </div>
          </div>
          {lines.length > 0 && (
            <div className="card" style={{ overflow: "hidden", marginBottom: 12 }}>
              <table>
                <thead><tr><th scope="col">Barang</th><th scope="col" className="num" style={{ width: 70 }}>Qty</th>
                  <th scope="col" className="num" style={{ width: 120 }}>Harga</th><th scope="col" className="num" style={{ width: 130 }}>Jumlah</th></tr></thead>
                <tbody>
                  {lines.map((l, i) => {
                    const it = co.items.find((x) => x.c === l.code);
                    return (<tr key={i}><td>{it ? it.n : l.code}</td>
                      <td className="num">{Number(l.qty).toLocaleString("id-ID")}</td>
                      <td className="num">{Number(l.price).toLocaleString("id-ID")}</td>
                      <td className="num">{l.amount.toLocaleString("id-ID")}</td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, color: "var(--tx-2)" }}>Total tagihan</span>
            <span style={{ marginLeft: "auto", fontSize: 20, fontWeight: 600 }}>{rp(inv.total)}</span>
          </div>
        </div>
        <div className="card" style={{ flex: "0 1 300px", padding: 14, alignSelf: "flex-start" }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 500 }}>Aktivitas</p>
          <Row icon={<Actor a={{ kind: "human", ini: DATA.user.ini }} />}
            text={<><b style={{ fontWeight: 500 }}>{DATA.user.name}</b> menerbitkan faktur ini</>} ago="baru saja" />
          <Row icon={<Actor a={{ kind: "system" }} />} text="Sistem memposting ke buku besar" ago="baru saja" last />
        </div>
      </div>
    </div>
  );
}

function Meta({ k, v }) {
  return (
    <span><span style={{ display: "block", fontSize: 11, color: "var(--tx-3)", marginBottom: 3 }}>{k}</span>
      <span style={{ fontWeight: 500 }}>{v}</span></span>
  );
}

/* ---------------------------------------------------------------- laba rugi */
const neg = (n) => (n < 0 ? `(${Math.abs(n).toLocaleString("id-ID")})` : n.toLocaleString("id-ID"));

function PnL({ co, onOpenInvoice }) {
  const [mi, setMi] = useState(co.monthly.length - 1);
  const [drill, setDrill] = useState(null);
  const m = co.monthly[mi];
  const p = co.monthly[mi - 1] || null;

  const period = m.label;
  const invOfMonth = useMemo(() => {
    const [mon, yr] = period.split(" ");
    const idx = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].indexOf(mon) + 1;
    const pre = `${yr}-${String(idx).padStart(2, "0")}`;
    return co.invoices.filter((i) => i.life === "posted" && i.issue.startsWith(pre));
  }, [co, period]);

  const gp = m.rev - m.cogs, gpP = p ? p.rev - p.cogs : 0;
  const op = gp - m.opex, opP = p ? gpP - p.opex : 0;

  const rows = [
    { k: "h", label: "Pendapatan" },
    { k: "a", label: "Penjualan barang", v: m.revG, pv: p ? p.revG : 0, acc: "4-1000", drill: "goods" },
    { k: "a", label: "Penjualan jasa", v: m.revS, pv: p ? p.revS : 0, acc: "4-2000", drill: "service" },
    { k: "s", label: "Total pendapatan", v: m.rev, pv: p ? p.rev : 0 },
    { k: "h", label: "Harga pokok penjualan" },
    { k: "a", label: "Harga pokok barang terjual", v: -m.cogs, pv: p ? -p.cogs : 0, acc: "5-1000" },
    { k: "s", label: "Laba kotor", v: gp, pv: gpP, strong: true },
    { k: "h", label: "Beban operasional" },
    ...m.opexMix.map(([n, v], i) => ({ k: "a", label: n, v: -v, pv: p ? -p.opexMix[i][1] : 0, acc: `6-${1000 + i * 100}` })),
    { k: "s", label: "Total beban operasional", v: -m.opex, pv: p ? -p.opex : 0 },
    { k: "s", label: "Laba usaha", v: op, pv: opP, strong: true },
  ];

  return (
    <div>
      <div className="card" style={{ padding: "10px 14px", marginBottom: 12, display: "flex",
        gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
          <span style={{ color: "var(--tx-2)" }}>Periode</span>
          <select value={mi} onChange={(e) => { setMi(Number(e.target.value)); setDrill(null); }}
            style={{ height: 30, border: "1px solid var(--bd-i)", borderRadius: 6, padding: "0 8px",
                     fontSize: 12.5, background: "var(--surf)", color: "var(--tx)" }}>
            {co.monthly.map((x, i) => <option key={x.label} value={i}>{x.label}</option>)}
          </select>
        </label>
        <span style={{ fontSize: 12, color: "var(--tx-2)" }}>
          Dibandingkan dengan {p ? p.label : "—"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--tx-3)" }}>
          {co.legal} · {co.cur} · dibuat 10 Agu 2026 11:04
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "1 1 420px", minWidth: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr>
                <th scope="col">Akun</th>
                <th scope="col" className="num" style={{ width: 130 }}>{m.label}</th>
                <th scope="col" className="num" style={{ width: 130 }}>{p ? p.label : "—"}</th>
                <th scope="col" className="num" style={{ width: 90 }}>Selisih</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  if (r.k === "h") return (
                    <tr key={i}><td colSpan={4} style={{ background: "var(--surf-s)", fontSize: 11,
                      letterSpacing: ".06em", textTransform: "uppercase", color: "var(--tx-2)",
                      height: 30, fontWeight: 500 }}>{r.label}</td></tr>
                  );
                  const d = r.pv ? ((r.v - r.pv) / Math.abs(r.pv)) * 100 : 0;
                  const clickable = !!r.drill;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: r.k === "s" ? 500 : 400,
                        paddingLeft: r.k === "a" ? 26 : 12,
                        borderTop: r.k === "s" ? "1px solid var(--bd-st)" : "none" }}>
                        {r.acc && <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11,
                          color: "var(--tx-3)", marginRight: 8 }}>{r.acc}</span>}
                        {clickable ? (
                          <button onClick={() => setDrill({ label: r.label, kind: r.drill, acc: r.acc })}
                            aria-label={`Telusuri ${r.label} periode ${m.label}`}
                            style={{ font: "inherit", color: "inherit" }}>
                            {r.label}
                            <span style={{ fontSize: 11, color: "var(--tx-acc)", marginLeft: 8 }}>telusuri</span>
                          </button>
                        ) : r.label}
                      </td>
                      <td className="num" style={{ fontWeight: r.strong ? 600 : r.k === "s" ? 500 : 400,
                        borderTop: r.k === "s" ? "1px solid var(--bd-st)" : "none" }}>{neg(r.v)}</td>
                      <td className="num" style={{ color: "var(--tx-2)",
                        borderTop: r.k === "s" ? "1px solid var(--bd-st)" : "none" }}>{p ? neg(r.pv) : "—"}</td>
                      <td className="num" style={{ fontSize: 12,
                        color: d === 0 ? "var(--tx-3)" : d > 0 ? "var(--ok-tx)" : "var(--dg-tx)",
                        borderTop: r.k === "s" ? "1px solid var(--bd-st)" : "none" }}>
                        {!p || !r.pv ? "—" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1).replace(".", ",")}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ margin: 0, padding: "9px 12px", borderTop: "1px solid var(--bd)", fontSize: 11,
            color: "var(--tx-3)" }}>
            Angka negatif ditulis dalam kurung. Klik baris pendapatan untuk menelusuri sampai ke faktur sumbernya.
          </p>
        </div>

        {drill && (
          <div className="card anim" style={{ flex: "0 1 340px", minWidth: 280, alignSelf: "flex-start" }}>
            <div style={{ padding: "11px 13px", borderBottom: "1px solid var(--bd)", display: "flex",
              alignItems: "flex-start", gap: 8 }}>
              <div>
                <p className="ovl" style={{ margin: "0 0 3px" }}>{drill.acc} · {m.label}</p>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{drill.label}</p>
              </div>
              <button onClick={() => setDrill(null)} aria-label="Tutup penelusuran"
                style={{ marginLeft: "auto", color: "var(--tx-3)" }}><X size={15} /></button>
            </div>
            {(() => {
              const list = invOfMonth
                .map((i) => ({ inv: i, amt: drill.kind === "goods" ? i.dg : i.ds }))
                .filter((x) => x.amt > 0);
              if (list.length === 0) return (
                <div style={{ padding: "28px 16px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500 }}>Tidak ada jurnal</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--tx-2)" }}>
                    Tidak ada transaksi {drill.label.toLowerCase()} pada {m.label}.
                  </p>
                </div>
              );
              return (
                <>
                  {list.map((x, i) => (
                    <button key={x.inv.no} onClick={() => onOpenInvoice(x.inv)}
                      style={{ display: "flex", gap: 10, width: "100%", textAlign: "left",
                        padding: "9px 13px", borderBottom: "1px solid var(--bd)", alignItems: "flex-start" }}>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 11.5, color: "var(--tx-2)" }}>
                          JU/2026/{m.label.includes("Agu") ? "08" : "07"}/{String(i + 1).padStart(4, "0")} · {x.inv.no}
                        </span>
                        <span style={{ display: "block", fontSize: 12.5, marginTop: 2 }}>{x.inv.cust}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--tx-3)" }}>{x.inv.issueD}</span>
                      </span>
                      <span style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{x.amt.toLocaleString("id-ID")}</span>
                    </button>
                  ))}
                  <div style={{ display: "flex", padding: "10px 13px", fontSize: 12.5, fontWeight: 500 }}>
                    <span>Total {list.length} jurnal</span>
                    <span style={{ marginLeft: "auto" }}>
                      {list.reduce((s, x) => s + x.amt, 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- placeholder */
function NotBuilt({ name }) {
  return (
    <div className="card" style={{ padding: "56px 24px", textAlign: "center" }}>
      <Building2 size={26} style={{ color: "var(--tx-3)" }} />
      <p style={{ margin: "12px 0 4px", fontWeight: 500 }}>{name} belum dibangun di prototype ini</p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--tx-2)" }}>
        Sesi ini mencakup shell, navigasi, dan perpindahan company. Modul lain menyusul di sesi berikutnya.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- app */
const MODULES = [
  { id: "dash", label: "Dashboard", icon: LayoutDashboard, nav: [] },
  { id: "sales", label: "Penjualan", icon: FileText,
    nav: [["Transaksi", ["Penawaran", "Pesanan", "Faktur", "Retur"]],
          ["Data induk", ["Pelanggan", "Daftar harga"]],
          ["Laporan", ["Penjualan per periode", "Umur piutang"]]] },
  { id: "inv", label: "Persediaan", icon: Package, nav: [] },
  { id: "buy", label: "Pembelian", icon: ShoppingCart, nav: [] },
  { id: "acc", label: "Akuntansi", icon: Calculator,
    nav: [["Transaksi", ["Jurnal umum", "Buku besar"]],
          ["Laporan", ["Laba rugi", "Neraca", "Arus kas"]]] },
  { id: "crm", label: "CRM", icon: Users, nav: [] },
];

export default function App() {
  const [db, setDb] = useState(DATA);
  const [view, setView] = useState({ name: "list" });
  const [toast, setToast] = useState(null);
  const [coId, setCoId] = useState("cmp_njaya");
  const [mod, setMod] = useState("dash");
  const [page, setPage] = useState("Faktur");
  const [theme, setTheme] = useState("light");
  const [density, setDensity] = useState("comfortable");
  const [open, setOpen] = useState(false);
  const [pal, setPal] = useState(false);
  const [help, setHelp] = useState(false);
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(false);

  const co = db.companies.find((c) => c.id === coId);
  const M = MODULES.find((m) => m.id === mod);

  useEffect(() => {
    const h = (e) => {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOpen(false); setHelp(false); setPal(true); return;
      }
      if (e.key === "?" && !typing) { e.preventDefault(); setHelp(true); return; }
      if (e.key === "Escape") { setOpen(false); setPal(false); setHelp(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const pick = (c) => {
    setOpen(false);
    if (c.id === coId) return;
    setLoading(true);
    setTimeout(() => {
      setCoId(c.id); setMod("dash"); setPage("Faktur"); setView({ name: "list" }); setLoading(false);
      setBanner(c.name);
      setTimeout(() => setBanner(null), 6000);
    }, 420);
  };

  const seqRef = useRef(4);
  const publish = (p) => {
    const no = `INV/2026/08/${String(seqRef.current++).padStart(4, "0")}`;
    const MN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    const due = new Date("2026-08-10T00:00:00");
    due.setDate(due.getDate() + p.term);
    const inv = {
      no, cust: p.cust, issue: "2026-08-10", issueD: "10 Agu 2026",
      due: due.toISOString().slice(0, 10),
      dueD: `${due.getDate()} ${MN[due.getMonth()]} ${due.getFullYear()}`,
      life: "posted", settle: "unpaid", total: p.total, out: p.total,
      lines: p.lines.map((l) => ({ code: l.code, qty: l.qty, price: l.price, amount: l.amount })),
      dpp: p.dpp,
    };
    setDb((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => {
        if (c.id !== coId) return c;
        const monthly = c.monthly.map((m, i) => (i === 11 ? { ...m, rev: m.rev + p.dpp } : m));
        return { ...c, invoices: [inv, ...c.invoices], monthly,
          kpi: { ...c.kpi, sales: monthly[11].rev, ar: c.kpi.ar + p.total } };
      }),
    }));
    setView({ name: "detail", inv });
    setToast({ no, total: p.total, dpp: p.dpp });
    setTimeout(() => setToast((tt) => (tt && tt.no === no ? null : tt)), 8000);
  };

  const undo = () => {
    const t0 = toast; if (!t0) return;
    setDb((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => {
        if (c.id !== coId) return c;
        const monthly = c.monthly.map((m, i) => (i === 11 ? { ...m, rev: m.rev - t0.dpp } : m));
        return { ...c, invoices: c.invoices.filter((x) => x.no !== t0.no), monthly,
          kpi: { ...c.kpi, sales: monthly[11].rev, ar: c.kpi.ar - t0.total } };
      }),
    }));
    setToast(null); setView({ name: "list" });
  };

  const title = mod === "dash" ? "Ringkasan"
    : mod === "sales" && page === "Faktur" && view.name === "form" ? "Faktur baru"
    : mod === "sales" && page === "Faktur" && view.name === "detail" ? view.inv.no
    : mod === "acc" && view.name === "detail" ? view.inv.no
    : mod === "sales" || mod === "acc" ? page : M.label;
  const crumb = mod === "dash" ? "Dashboard"
    : mod === "acc" ? `${M.label} · Laporan` : `${M.label} · Transaksi`;

  return (
    <div className="pf" data-theme={theme} data-density={density}
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      <style>{CSS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono&display=swap" />
      <a href="#main" className="skip">Lewati ke konten utama</a>

      {/* top bar */}
      <header style={{ height: 46, display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        borderBottom: "1px solid var(--bd)", background: "var(--surf)", position: "relative", zIndex: 30 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--tx)", flex: "none" }} />
        <div style={{ position: "relative" }}>
          <button onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 9px",
                     border: "1px solid var(--bd-i)", borderRadius: 6, fontSize: 12.5, background: "var(--surf)" }}>
            <span style={{ color: "var(--tx-3)" }}>{DATA.tenant.name}</span>
            <span style={{ color: "var(--bd-st)" }}>/</span>
            <span style={{ fontWeight: 500 }}>{co.name}</span>
            <ChevronDown size={14} style={{ color: "var(--tx-3)" }} />
          </button>
          {open && <Switcher co={co} onPick={pick} onClose={() => setOpen(false)} />}
        </div>
        <button onClick={() => setPal(true)} aria-label="Buka perintah cepat"
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", border: "1px solid var(--bd)",
                   borderRadius: 6, fontSize: 12.5, color: "var(--tx-3)", minWidth: 150 }}>
          <Search size={14} />Cari<span style={{ marginLeft: "auto", fontSize: 11 }}>⌘K</span>
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => setDensity((d) => (d === "compact" ? "comfortable" : "compact"))}
            aria-label="Ubah kepadatan tampilan" title="Kepadatan"
            style={{ padding: 7, borderRadius: 6, color: density === "compact" ? "var(--tx-acc)" : "var(--tx-2)" }}>
            <Rows3 size={17} /></button>
          <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Ubah tema" title="Tema" style={{ padding: 7, borderRadius: 6, color: "var(--tx-2)" }}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button aria-label="Asisten AI" style={{ padding: 7, borderRadius: 6, color: "var(--tx-2)" }}><Sparkles size={17} /></button>
          <button aria-label="Notifikasi" style={{ padding: 7, borderRadius: 6, color: "var(--tx-2)" }}><Bell size={17} /></button>
          <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--acc-sub)",
            color: "var(--tx-acc)", fontSize: 11, fontWeight: 500, display: "flex",
            alignItems: "center", justifyContent: "center", marginLeft: 4 }}>{DATA.user.ini}</span>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* rail */}
        <nav aria-label="Modul" style={{ width: 46, borderRight: "1px solid var(--bd)", background: "var(--surf)",
          padding: "8px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {MODULES.map((m) => (
            <button key={m.id} className="rail-i" aria-current={mod === m.id ? "page" : undefined}
              aria-label={m.label} title={m.label}
              onClick={() => { setMod(m.id); setPage(m.id === "acc" ? "Laba rugi" : "Faktur"); setView({ name: "list" }); }}>
              <m.icon size={18} />
            </button>
          ))}
          <div style={{ width: 22, height: 1, background: "var(--bd)", margin: "4px 0" }} />
          <button className="rail-i" aria-label="Semua modul" title="Semua modul"><Grid3x3 size={18} /></button>
        </nav>

        {/* sidebar */}
        {M.nav.length > 0 && (
          <nav aria-label={`Navigasi ${M.label}`} style={{ width: 190, borderRight: "1px solid var(--bd)",
            background: "var(--surf)", padding: "10px 8px", flex: "none" }}>
            <p style={{ margin: "2px 8px 8px", fontSize: 13, fontWeight: 500 }}>{M.label}</p>
            {M.nav.map(([grp, items]) => (
              <div key={grp}>
                <p className="ovl" style={{ margin: "10px 8px 4px" }}>{grp}</p>
                {items.map((it) => (
                  <button key={it} className="nav-i" aria-current={page === it ? "page" : undefined}
                    onClick={() => { setPage(it); setView({ name: "list" }); }}>{it}</button>
                ))}
              </div>
            ))}
          </nav>
        )}

        {/* content */}
        <main id="main" style={{ flex: 1, minWidth: 0, padding: "14px var(--pad) 28px", overflow: "auto" }}>
          {banner && (
            <div className="anim" role="status" aria-live="assertive"
              style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 14px",
                       background: "var(--acc-sub)", borderRadius: 10, marginBottom: 14 }}>
              <ArrowRightCircle size={18} style={{ color: "var(--tx-acc)", flex: "none" }} />
              <div>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: "var(--tx-acc)" }}>
                  Konteks berpindah ke {banner}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--tx-acc)" }}>
                  Seluruh data yang Anda lihat dan buat sekarang milik company ini.</p>
              </div>
              <button onClick={() => setBanner(null)} aria-label="Tutup"
                style={{ marginLeft: "auto", color: "var(--tx-acc)" }}><X size={15} /></button>
            </div>
          )}

          <p style={{ margin: "0 0 3px", fontSize: 11, color: "var(--tx-3)" }}>{crumb}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, letterSpacing: "-.01em" }}>{title}</h1>
            {mod === "sales" && page === "Faktur" && view.name === "list" && (
              <button className="btn btn-p" style={{ marginLeft: "auto" }}
                onClick={() => setView({ name: "form" })}>Buat faktur</button>
            )}
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 11.5, color: "var(--tx-2)" }}>
            {co.name} · {co.fyLabel} {co.period} · Agustus 2026 · {co.cur}
          </p>

          {loading ? (
            <TableSkeleton />
          ) : mod === "dash" ? <Dashboard co={co} />
            : mod === "sales" && page === "Faktur" && view.name === "form"
              ? <InvoiceForm co={co} onCancel={() => setView({ name: "list" })} onPublish={publish} />
            : mod === "sales" && page === "Faktur" && view.name === "detail"
              ? <InvoiceDetail co={co} inv={view.inv} onBack={() => setView({ name: "list" })} />
            : mod === "acc" && page === "Laba rugi" && view.name === "detail"
              ? <InvoiceDetail co={co} inv={view.inv} onBack={() => setView({ name: "list" })} />
            : mod === "acc" && page === "Laba rugi"
              ? <PnL co={co} onOpenInvoice={(i) => setView({ name: "detail", inv: i })} />
            : mod === "sales" && page === "Faktur"
              ? <Invoices co={co} onOpen={(i) => setView({ name: "detail", inv: i })} />
            : <NotBuilt name={mod === "sales" ? page : M.label} />}
        </main>
      </div>

      {pal && (
        <Palette co={co} db={db} onClose={() => setPal(false)}
          onNav={(it) => {
            setMod(it.go.mod);
            if (it.go.page) setPage(it.go.page);
            setView(it.go.view ? { name: it.go.view } : { name: "list" });
          }}
          onCompany={(c) => pick(c)} />
      )}
      {help && <Help onClose={() => setHelp(false)} />}

      {toast && (
        <div className="anim" role="status" aria-live="polite"
          style={{ position: "fixed", right: 16, bottom: 16, zIndex: 55, maxWidth: 380,
                   display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px",
                   background: "var(--surf-r)", border: "1px solid var(--bd)", borderRadius: 10,
                   boxShadow: "0 12px 32px rgba(16,19,25,.16)" }}>
          <Check size={17} style={{ color: "var(--ok-tx)", flex: "none", marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500 }}>Faktur {toast.no} terbit</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--tx-2)" }}>
              {rp(toast.total)} · sudah masuk ke dashboard dan piutang</p>
          </div>
          <button onClick={undo} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500,
            color: "var(--tx-acc)", whiteSpace: "nowrap" }}>Urungkan</button>
        </div>
      )}
    </div>
  );
}
