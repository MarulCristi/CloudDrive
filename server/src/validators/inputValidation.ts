import { body, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

export const registerValidation = [
    body('username').trim().isLength({ min: 5, max: 25 }).withMessage("Username needs to be 5-25 characters.").escape(),
    body('email').trim().isEmail().withMessage("Email is not valid").normalizeEmail().escape(),
    body('password')
    .isLength({ min: 8 }).withMessage("Password needs to be at least 8 characters")
    .matches(/[A-Z]/).withMessage("Password needs to have at least 1 uppercase").matches(/[a-z]/).withMessage("Password needs to be at least 1 lower case")
    .matches(/\d/).withMessage("Password needs to be at least 1 digit")
    .matches(/[#!&%?]/).withMessage("Password needs to have at least 1 special character")
    .not().matches(/(.)\1\1/).withMessage("Password cannot have the same character 3 times sequentially.") // new password match i decided to add.
]

export const loginValidation = [
    body('email').trim().escape(),
    body('password').exists({ checkFalsy: true})
]

export const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array()});
  next()
};