import type {RequestHandler} from "express";
/** Public diagnostics are not operator authorization. Retained private reads stay CLI-only. */
export const finiteCompanyPrivacy:RequestHandler=(req,res,next)=>{
 if(req.method==="POST"&&req.path==="/api/calculation/research-contracts"&&
  ["reviewed-company-projection","reviewed-finite-company-document","reviewed-renewal-company-document","reviewed-funded-company-document"].includes(req.body?.operation)){
  res.status(403).json({error:"operator-cli-required",
   message:"Retained private company results require the authorized operator CLI. No authenticated HTTP reader is configured."});
  return;
 }
 next();
};
