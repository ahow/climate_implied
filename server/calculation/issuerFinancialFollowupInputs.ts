export function observedPermitBoundary(x:{applicationStatus:string;approvalDate:string|null;finalPermitDocumentVerified:boolean}){
  return{observedFinalPermitVerified:x.applicationStatus==="Approved"&&x.approvalDate!==null&&
      Number.isFinite(Date.parse(x.approvalDate))&&x.finalPermitDocumentVerified,
    applicationIsNotPermit:true,conditionalForwardPermissionAssumptionStillPossible:true};
}
export function qualifyRoseTracker(text:string){
  if(!text.includes("Last Updated: 11/05/2026")||!text.includes("Texas RRC Class VI Application Tracker"))throw new Error("Exact dated original tracker required");
  const lines=text.split(/\r?\n/),i=lines.findIndex(s=>/^\s*57803\s+Rose CCS\s/.test(s));
  if(i<1||!/^\s*57803\s+Rose CCS\s+Jefferson\s+03\s+Fleming, Upper Frio\s+3\s+3,340'-8,455'\s+03\/14\/2024\s+Hearing\s+Yes\s+10\/31\/2025\s*$/.test(lines[i]))
    throw new Error("Exact Roseapplication row changed/unlocated; new qualification required");
  if(!lines[i-1].includes("ExxonMobil Low Carbon Sol.")||!lines[i-1].includes("OG-25-")||
    !lines[i+1].includes("Onshore LLC")||!lines[i+1].includes("00029632"))throw new Error("Exact multi-line operator/docket not qualified");
  return{asOf:"2026-11-05",publisher:"Railroad Commission of Texas",sourcePage:1,
    rrcTrackingNumber:"57803",trackingNumberIsNotFinalPermitNumber:true,
    operatorAsPrinted:"ExxonMobil Low Carbon Sol. Onshore LLC",operatorNameIsAbbreviated:true,
    legalRegistryIdentityVerified:false,projectAsPrinted:"Rose CCS",county:"Jefferson",state:"Texas",rrcDistrict:"03",
    formationAsPrinted:"Fleming, Upper Frio",numberOfInjectionWellsInApplication:3,
    injectionIntervalTvdFeet:{minimum:3340,maximum:8455},submittedDate:"2024-03-14",
    applicationStatus:"Hearing",protested:true,referredToHearingDate:"2025-10-31",docket:"OG-25-00029632",
    approvalDatePublishedInRow:null,finalPermitDocumentVerified:false,
    cfContractToTrackingNumberCrosswalkVerified:false,actualAnnualInjectionTonnes:null,siteCoordinates:null,
    permittedNativeGasComposition:null,ccsCashFeeOrMinimumBillings:null,
    observationBoundary:observedPermitBoundary({applicationStatus:"Hearing",approvalDate:null,finalPermitDocumentVerified:false})};
}
